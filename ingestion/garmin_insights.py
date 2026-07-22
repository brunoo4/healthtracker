"""
garmin_insights.py
==================
Extrai dados de treino e saúde do Garmin Connect e grava um JSON
normalizado, pronto para ser consumido pelo seed do garmin-dashboard.

Princípios desta versão:
  - Unidades cruas e em SI (metros, segundos). Nada de valor derivado
    ou formatado: pace, ritmo e percentuais são calculados na leitura.
  - Todo campo carrega a unidade no nome quando há ambiguidade.
  - Cada atividade traz o activity_id do Garmin (chave de idempotência).
  - Métricas diárias saem já consolidadas por data em `daily_metrics`.

SETUP:
  1. pip3 install "garminconnect>=0.3.0" python-dotenv
  2. Crie um .env nesta pasta (veja .env.example)
  3. python3 garmin_insights.py
"""

import json
import logging
import os
import sys
import time
from datetime import date, datetime, timedelta
from getpass import getpass
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

# ── Configuração ───────────────────────────────────────────────────────────────

SCHEMA_VERSION = 3

EMAIL = os.getenv("GARMIN_EMAIL") or input("Garmin email: ")
PASSWORD = os.getenv("GARMIN_PASSWORD") or getpass("Garmin password: ")

DAYS_BACK = int(os.getenv("SYNC_DEFAULT_DAYS", "30"))
REQUEST_DELAY = float(os.getenv("REQUEST_DELAY_SECONDS", "1"))
SESSION_PATH = os.getenv("GARMIN_SESSION_PATH", ".garmin_session")
OUTPUT_DIR = Path(os.getenv("OUTPUT_DIR", "output"))
OUTPUT_FILE = OUTPUT_DIR / "garmin_data.json"

TODAY = date.today()
START_DATE = TODAY - timedelta(days=DAYS_BACK)
START_STR = START_DATE.isoformat()
TODAY_STR = TODAY.isoformat()

logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO").upper(),
    format="%(asctime)s  %(levelname)-7s %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("garmin")


# ── Helpers ────────────────────────────────────────────────────────────────────

def safe(fn, *args, default=None, **kwargs):
    """Executa fn tolerando falha. Respeita o delay entre requisições."""
    try:
        return fn(*args, **kwargs)
    except Exception as exc:
        log.warning("%s falhou: %s", getattr(fn, "__name__", fn), exc)
        return default
    finally:
        if REQUEST_DELAY:
            time.sleep(REQUEST_DELAY)


def num(val, decimals=2):
    """Converte para float arredondado, ou None."""
    try:
        if val is None:
            return None
        return round(float(val), decimals)
    except (TypeError, ValueError):
        return None


def num_nz(val, decimals=2):
    """Como num(), mas 0 vira None.

    Musculação devolve distance/speed = 0 enquanto devolve null para
    max_speed, cadência e passada — inconsistência da própria API.
    Zero aqui não é medição, é "não se aplica", e contaminaria qualquer
    média de pace ou distância calculada depois.
    """
    result = num(val, decimals)
    return None if result == 0 else result


def integer(val):
    try:
        if val is None:
            return None
        return int(val)
    except (TypeError, ValueError):
        return None


def local_date(timestamp):
    """Data pura a partir do horário local do Garmin ('YYYY-MM-DD HH:MM:SS')."""
    if not isinstance(timestamp, str) or len(timestamp) < 10:
        return None
    return timestamp[:10]


def iso(timestamp, utc=False):
    """Normaliza o timestamp do Garmin para ISO-8601.

    O Garmin devolve 'YYYY-MM-DD HH:MM:SS' — espaço no lugar do T e sem
    marcador de fuso, o que o Date() do JS interpreta de forma diferente
    conforme o runtime.
    """
    if not isinstance(timestamp, str) or " " not in timestamp:
        return timestamp
    return timestamp.replace(" ", "T") + ("Z" if utc else "")


def dig(source, *keys, default=None):
    """Navega dicionários aninhados sem estourar em None."""
    current = source
    for key in keys:
        if not isinstance(current, dict):
            return default
        current = current.get(key)
    return current if current is not None else default


def date_range():
    """Datas do período, da mais antiga para a mais recente."""
    for offset in range(DAYS_BACK + 1):
        yield (START_DATE + timedelta(days=offset)).isoformat()


# ── Login ──────────────────────────────────────────────────────────────────────

def login():
    from garminconnect import Garmin, GarminConnectAuthenticationError

    def mfa_prompt():
        return input("Código MFA (cheque e-mail/app): ")

    log.info("Conectando ao Garmin Connect...")

    # Tentativa 1: reaproveitar sessão salva, evitando novo login e MFA.
    if Path(SESSION_PATH).exists():
        try:
            client = Garmin()
            client.login(SESSION_PATH)
            log.info("Sessão restaurada de %s", SESSION_PATH)
            return client
        except Exception as exc:
            log.warning("Sessão inválida (%s). Autenticando do zero.", exc)

    # Tentativa 2: login com credenciais.
    try:
        client = Garmin(EMAIL, PASSWORD, prompt_mfa=mfa_prompt)
        client.login()
        log.info("Logado como: %s", safe(client.get_full_name, default="?"))
    except GarminConnectAuthenticationError as exc:
        log.error("Falha de autenticação: %s", exc)
        sys.exit(1)
    except Exception as exc:
        log.error("Erro inesperado no login: %s", exc)
        sys.exit(1)

    # Persiste a sessão para as próximas execuções.
    try:
        client.garth.dump(SESSION_PATH)
        log.debug("Sessão salva em %s", SESSION_PATH)
    except Exception as exc:
        log.debug("Não foi possível salvar a sessão: %s", exc)

    return client


# ── Atividades ─────────────────────────────────────────────────────────────────

# Família do esporte a partir do activityType.typeKey do Garmin. Existe
# porque esteira e rua são tipos SEPARADOS lá: sem agrupar, o filtro por
# corrida e o volume semanal deixariam as de esteira de fora.
SPORT_BY_TYPE = {
    "running": "run",
    "treadmill_running": "run",
    "strength_training": "strength",
}


def fetch_activities(client):
    """
    Busca TODAS as atividades do período, não só corrida.
    Musculação e demais esportes entram agora para não exigir
    recarga histórica quando o domínio de força for implementado.
    """
    log.info("Buscando atividades de %s a %s...", START_STR, TODAY_STR)
    raw = safe(client.get_activities_by_date, START_STR, TODAY_STR, default=[]) or []

    activities = []
    for act in raw:
        activity_id = act.get("activityId")
        if activity_id is None:
            log.warning("Atividade sem activityId ignorada: %s", act.get("activityName"))
            continue

        activity_type = dig(act, "activityType", "typeKey")

        activities.append({
            "activity_id": str(activity_id),
            "activity_type": activity_type,
            # O tipo cru fica para o detalhe; agregação e filtro usam a
            # família. Tipo novo do Garmin cai em "other" em vez de quebrar
            # a ingestão.
            "sport": SPORT_BY_TYPE.get(activity_type, "other"),
            "name": act.get("activityName"),
            # Data pura pelo horário LOCAL, não GMT: treino às 22h no Brasil
            # cai no dia seguinte em UTC, e o agrupamento por dia tem que
            # seguir o dia vivido. É o que permite cruzar atividade com a
            # métrica diária.
            "date": local_date(act.get("startTimeLocal")),
            "started_at": iso(act.get("startTimeLocal")),
            "started_at_gmt": iso(act.get("startTimeGMT"), utc=True),
            "duration_s": num(act.get("duration"), 1),
            "moving_duration_s": num(act.get("movingDuration"), 1),
            "distance_m": num_nz(act.get("distance"), 1),
            "avg_speed_mps": num_nz(act.get("averageSpeed"), 4),
            "max_speed_mps": num(act.get("maxSpeed"), 4),
            "avg_hr_bpm": integer(act.get("averageHR")),
            "max_hr_bpm": integer(act.get("maxHR")),
            "calories": num(act.get("calories"), 0),
            "elevation_gain_m": num(act.get("elevationGain"), 1),
            "elevation_loss_m": num(act.get("elevationLoss"), 1),
            "avg_cadence_spm": num(act.get("averageRunningCadenceInStepsPerMinute"), 1),
            "max_cadence_spm": num(act.get("maxRunningCadenceInStepsPerMinute"), 1),
            # avgStrideLength vem em CENTÍMETROS na API do Garmin.
            "avg_stride_length_m": num_nz((act.get("avgStrideLength") or 0) / 100, 3),
            "training_effect_aerobic": num(act.get("aerobicTrainingEffect"), 1),
            "training_effect_anaerobic": num(act.get("anaerobicTrainingEffect"), 1),
            "training_load": num(act.get("activityTrainingLoad"), 2),
            "vo2max_estimated": num(act.get("vO2MaxValue"), 1),
            "splits": fetch_splits(client, activity_id),
            "hr_zones": fetch_hr_zones(client, activity_id),
        })

    log.info("%d atividades coletadas.", len(activities))
    return activities


def fetch_splits(client, activity_id):
    """Voltas da atividade, em unidades cruas. Pace é derivado na leitura."""
    raw = safe(client.get_activity_splits, activity_id, default={}) or {}
    splits = []
    for index, lap in enumerate(raw.get("lapDTOs") or [], start=1):
        distance = lap.get("distance")
        if not distance or distance <= 100:  # descarta voltas residuais
            continue
        splits.append({
            "index": index,
            "distance_m": num(distance, 1),
            "duration_s": num(lap.get("duration"), 1),
            "avg_speed_mps": num_nz(lap.get("averageMovingSpeed"), 4),
            "avg_hr_bpm": integer(lap.get("averageHR")),
            "max_hr_bpm": integer(lap.get("maxHR")),
            "elevation_gain_m": num(lap.get("elevationGain"), 1),
        })
    return splits


def fetch_hr_zones(client, activity_id):
    """Tempo por zona de FC, em segundos. Percentual é derivado na leitura."""
    raw = safe(client.get_activity_hr_in_timezones, activity_id, default=[]) or []
    return [
        {
            "zone": integer(zone.get("zoneNumber")),
            "seconds_in_zone": num(zone.get("secsInZone"), 1),
            "zone_low_bpm": num(zone.get("zoneLowBoundary"), 0),
        }
        for zone in raw
    ]


# ── Métricas diárias ───────────────────────────────────────────────────────────

def fetch_daily_stats(client):
    """
    get_stats é a fonte correta para passos, estresse, FC de repouso e
    body battery — dados que a versão anterior tentava ler do sono e
    voltavam sempre nulos.
    """
    log.info("Buscando resumo diário (passos, estresse, FC repouso, body battery)...")
    result = {}
    for day in date_range():
        stats = safe(client.get_stats, day, default=None)
        if not stats:
            continue
        result[day] = {
            "steps": integer(stats.get("totalSteps")),
            "resting_heart_rate_bpm": integer(stats.get("restingHeartRate")),
            "min_heart_rate_bpm": integer(stats.get("minHeartRate")),
            "max_heart_rate_bpm": integer(stats.get("maxHeartRate")),
            "stress_avg": integer(stats.get("averageStressLevel")),
            "stress_max": integer(stats.get("maxStressLevel")),
            "body_battery_charged": integer(stats.get("bodyBatteryChargedValue")),
            "body_battery_drained": integer(stats.get("bodyBatteryDrainedValue")),
            "body_battery_max": integer(stats.get("bodyBatteryHighestValue")),
            "body_battery_min": integer(stats.get("bodyBatteryLowestValue")),
            "active_calories": integer(stats.get("activeKilocalories")),
            "floors_climbed": integer(stats.get("floorsAscended")),
        }
    log.info("%d dias com resumo diário.", len(result))
    return result


def fetch_hrv(client):
    """
    Correção relevante: a chave da média da noite é `lastNightAvg`,
    não `lastNight` — por isso o campo vinha nulo em 100% dos dias.

    Esta é a fonte primária de HRV. O sono também expõe `avgOvernightHrv`,
    idêntico em 61/61 dias (inclusive nos dias sem dado), e foi removido
    por ser duplicata. Consequência aceita: dia sem `hrvSummary` sai sem
    HRV, em vez de cair num fallback implícito entre duas fontes.
    """
    log.info("Buscando HRV...")
    result = {}
    for day in date_range():
        hrv = safe(client.get_hrv_data, day, default=None)
        summary = dig(hrv, "hrvSummary")
        if not summary:
            continue
        status = summary.get("status")
        result[day] = {
            "hrv_last_night_ms": integer(summary.get("lastNightAvg")),
            "hrv_5min_high_ms": integer(summary.get("lastNight5MinHigh")),
            "hrv_weekly_avg_ms": integer(summary.get("weeklyAvg")),
            # 'NONE' é sentinela de string para "sem status" e convive com
            # o None de verdade. Duas formas de dizer o mesmo — colapsa numa.
            "hrv_status": None if status == "NONE" else status,
            "hrv_baseline_low_ms": integer(dig(summary, "baseline", "lowUpper")),
            "hrv_baseline_high_ms": integer(dig(summary, "baseline", "balancedUpper")),
        }
    log.info("%d dias com HRV.", len(result))
    return result


def fetch_sleep(client):
    """
    Correção mantida: sleepScores pode vir nulo e quebrava a navegação.

    SpO2 e respiração noturnos foram removidos: nulos em 61/61 dias. A
    navegação estava certa (avgOvernightHrv, irmão no mesmo nível, vinha
    preenchido) — o Pulse Ox noturno é que está desligado no relógio.
    Voltam quando o sensor for ligado.
    """
    log.info("Buscando sono...")
    result = {}
    for day in date_range():
        sleep = safe(client.get_sleep_data, day, default=None)
        daily = dig(sleep, "dailySleepDTO")
        if not daily:
            continue
        row = {
            "sleep_duration_s": integer(daily.get("sleepTimeSeconds")),
            "sleep_deep_s": integer(daily.get("deepSleepSeconds")),
            "sleep_light_s": integer(daily.get("lightSleepSeconds")),
            "sleep_rem_s": integer(daily.get("remSleepSeconds")),
            "sleep_awake_s": integer(daily.get("awakeSleepSeconds")),
            "sleep_score": integer(dig(daily, "sleepScores", "overall", "value")),
        }
        check_sleep_phases(day, row)
        result[day] = row
    log.info("%d dias com sono.", len(result))
    return result


def check_sleep_phases(day, row):
    """Sentinela de dado corrompido: as fases somam a duração, com folga.

    deep + light + rem = sleep_duration_s, com `awake` fora da soma. Não é
    exato: em 61 dias, 17 noites divergiram de 1 a 39 segundos por causa do
    arredondamento na atribuição de fases. Por isso a checagem é de ordem de
    grandeza — como igualdade estrita, reprovaria 29% dos dados bons.
    """
    fases = [row["sleep_deep_s"], row["sleep_light_s"], row["sleep_rem_s"]]
    if row["sleep_duration_s"] is None or any(f is None for f in fases):
        return
    desvio = abs(sum(fases) - row["sleep_duration_s"])
    if desvio > 60:
        log.warning("%s: fases do sono desviam %ds da duração.", day, desvio)


def fetch_training_readiness(client):
    """Substitui o antigo get_training_status, que devolvia lista vazia."""
    log.info("Buscando training readiness...")
    result = {}
    for day in date_range():
        raw = safe(client.get_training_readiness, day, default=None)
        entry = raw[0] if isinstance(raw, list) and raw else raw
        if not isinstance(entry, dict):
            continue
        result[day] = {
            "readiness_score": integer(entry.get("score")),
            "readiness_level": entry.get("level"),
            # recoveryTime vem em MINUTOS. Confirmado na distribuição de 61
            # dias: mediana 201, máximo 4026 — 67h de recuperação depois de
            # um treino pesado. Em horas, 4026 seriam 168 dias.
            "recovery_time_min": integer(entry.get("recoveryTime")),
        }
    log.info("%d dias com readiness.", len(result))
    return result


# Conjunto canônico de colunas de daily_metrics. É o contrato: a tabela
# do banco e os tipos do TypeScript derivam desta lista.
DAILY_METRIC_FIELDS = (
    # Atividade geral
    "steps",
    "active_calories",
    "floors_climbed",
    # Cardio
    "resting_heart_rate_bpm",
    "min_heart_rate_bpm",
    "max_heart_rate_bpm",
    # Estresse
    "stress_avg",
    "stress_max",
    # Body battery
    "body_battery_charged",
    "body_battery_drained",
    "body_battery_max",
    "body_battery_min",
    # HRV
    "hrv_last_night_ms",
    "hrv_5min_high_ms",
    "hrv_weekly_avg_ms",
    "hrv_status",
    "hrv_baseline_low_ms",
    "hrv_baseline_high_ms",
    # Sono
    "sleep_duration_s",
    "sleep_deep_s",
    "sleep_light_s",
    "sleep_rem_s",
    "sleep_awake_s",
    "sleep_score",
    # Readiness
    "readiness_score",
    "readiness_level",
    "recovery_time_min",
)


def build_daily_metrics(*sources):
    """
    Consolida as fontes diárias numa única linha por data.
    Esta é a forma que a tabela daily_metrics espera.

    Toda linha carrega TODAS as chaves: um dia sem HRV sai com hrv_* = None,
    não com as chaves ausentes. Antes, uma fonte que falhasse sumia com suas
    chaves da linha inteira, e o consumidor levava KeyError em vez de None.
    Lacuna explícita, forma estável.
    """
    days = sorted({day for source in sources for day in source})
    merged = []
    for day in days:
        row = {"date": day, **dict.fromkeys(DAILY_METRIC_FIELDS)}
        for source in sources:
            row.update(source.get(day, {}))
        merged.append(row)
    return merged


# ── Contexto (não diário) ──────────────────────────────────────────────────────

def fetch_fitness(client):
    """
    Previsões de prova.

    vo2max_running e fitness_age foram removidos: vinham nulos de
    get_max_metrics, que saiu junto (uma requisição a menos). Não é
    bloqueante — o VO2max confiável entra por atividade de corrida, em
    `vo2max_estimated`. Voltam quando a chamada for investigada.
    """
    log.info("Buscando previsões de prova...")
    race = safe(client.get_race_predictions, default={}) or {}

    return {
        # As previsões são um snapshot sem data própria na resposta do
        # Garmin. A data entra aqui para que possam ser persistidas como
        # série — uma linha por sincronização — em vez de sobrescritas.
        "date": TODAY_STR,
        "race_prediction_5k_s": integer(race.get("time5K")),
        "race_prediction_10k_s": integer(race.get("time10K")),
        "race_prediction_half_s": integer(race.get("timeHalfMarathon")),
        "race_prediction_full_s": integer(race.get("timeMarathon")),
    }


def fetch_gear(client, profile):
    """
    Correção: get_gear espera o userProfileNumber (numérico),
    não o displayName — motivo de a lista vir sempre vazia.

    TODO(pós-MVP): ainda vem vazio em 60 dias, então a correção do
    profile_id não bastou. Próximo suspeito: o filtro gearTypeName ==
    "shoes" abaixo, que descarta todo o resto e pode estar comparando
    com o rótulo errado. Fora do MVP.
    """
    log.info("Buscando calçados...")
    profile_id = (
        profile.get("userProfileId")
        or profile.get("profileId")
        or profile.get("id")
    )
    if not profile_id:
        log.warning("userProfileId não encontrado; pulando gear.")
        return []

    gear_list = safe(client.get_gear, profile_id, default=[]) or []
    shoes = []
    for gear in gear_list:
        if gear.get("gearTypeName") != "shoes":
            continue
        shoes.append({
            "gear_id": gear.get("uuid") or gear.get("gearPk"),
            "name": gear.get("displayName") or gear.get("customMakeModel"),
            "total_distance_m": num(gear.get("totalDistance"), 1),
            "max_distance_m": num(gear.get("maximumMeters"), 1),
            "date_begin": gear.get("dateBegin"),
            "retired": gear.get("gearStatusName") == "retired",
        })
    log.info("%d calçado(s).", len(shoes))
    return shoes


def fetch_scheduled_workouts(client):
    """
    Treinos agendados. O antigo get_training_plans retornava strings soltas
    (nomes de chave, não dados) e foi removido.

    TODO(pós-MVP): vem vazio, e como há plano do Garmin Coach ativo isso é
    provavelmente bug, não ausência de dado. Suspeitos: a assinatura de
    get_scheduled_workouts e a janela de 56 dias abaixo. Fora do MVP.
    """
    log.info("Buscando treinos agendados...")
    end = (TODAY + timedelta(days=56)).isoformat()
    raw = safe(client.get_scheduled_workouts, TODAY_STR, end, default=[]) or []

    scheduled = []
    for item in raw:
        if not isinstance(item, dict):
            continue
        scheduled.append({
            "workout_id": item.get("workoutId"),
            "scheduled_date": item.get("date"),
            "title": item.get("title"),
            "sport": item.get("sportTypeKey"),
            "planned_distance_m": num(item.get("estimatedDistanceInMeters"), 1),
            "planned_duration_s": integer(item.get("estimatedDurationInSecs")),
        })
    log.info("%d treino(s) agendado(s).", len(scheduled))
    return scheduled


# ── Main ───────────────────────────────────────────────────────────────────────

def main():
    client = login()
    profile = safe(client.get_user_profile, default={}) or {}

    log.info("Período: %s a %s (%d dias)", START_STR, TODAY_STR, DAYS_BACK)

    daily_metrics = build_daily_metrics(
        fetch_daily_stats(client),
        fetch_hrv(client),
        fetch_sleep(client),
        fetch_training_readiness(client),
    )

    payload = {
        "meta": {
            "schema_version": SCHEMA_VERSION,
            "generated_at": datetime.now().isoformat(timespec="seconds"),
            "start_date": START_STR,
            "end_date": TODAY_STR,
            "period_days": DAYS_BACK,
            "units": {
                "distance": "meters",
                "duration": "seconds",
                "speed": "meters_per_second",
                "cadence": "steps_per_minute",
            },
        },
        "daily_metrics": daily_metrics,
        "activities": fetch_activities(client),
        "fitness": fetch_fitness(client),
        "gear": fetch_gear(client, profile),
        "scheduled_workouts": fetch_scheduled_workouts(client),
    }

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_FILE, "w", encoding="utf-8") as handle:
        json.dump(payload, handle, ensure_ascii=False, indent=2)

    log.info("Arquivo gravado: %s", OUTPUT_FILE)
    for rotulo, chave in (
        ("dias com métrica", "daily_metrics"),
        ("atividades", "activities"),
        ("calçados", "gear"),
        ("treinos futuros", "scheduled_workouts"),
    ):
        total = len(payload[chave])
        # Coleção vazia é sintoma de bug conhecido (ver os TODO em fetch_gear
        # e fetch_scheduled_workouts) — não pode sumir no meio do INFO.
        log.log(logging.WARNING if total == 0 else logging.INFO,
                "  %-18s %d", rotulo + ":", total)


if __name__ == "__main__":
    main()