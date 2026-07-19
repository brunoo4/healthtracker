"""
garmin_insights.py
==================
Puxa dados de treino do Garmin Connect e gera um JSON
pronto para análise de insights com o Claude.

SETUP:
  1. pip install garminconnect python-dotenv
  2. Crie um arquivo .env na mesma pasta com:
       GARMIN_EMAIL=seu@email.com
       GARMIN_PASSWORD=suasenha
  3. python garmin_insights.py

O script vai gerar: garmin_data.json
Cole o conteúdo desse arquivo numa conversa com o Claude.
"""

import json
import os
import sys
from datetime import date, timedelta
from getpass import getpass

from dotenv import load_dotenv

load_dotenv()

# ── Credenciais ────────────────────────────────────────────────────────────────

EMAIL    = os.getenv("GARMIN_EMAIL")    or input("Garmin email: ")
PASSWORD = os.getenv("GARMIN_PASSWORD") or getpass("Garmin password: ")

# ── Janela de dados ────────────────────────────────────────────────────────────

DAYS_BACK   = 30          # quantos dias de histórico puxar
TODAY       = date.today()
START_DATE  = TODAY - timedelta(days=DAYS_BACK)
START_STR   = START_DATE.isoformat()
TODAY_STR   = TODAY.isoformat()

# ── Login ──────────────────────────────────────────────────────────────────────

def login():
    from garminconnect import Garmin, GarminConnectAuthenticationError

    def mfa_prompt():
        return input("MFA code (cheque seu e-mail/app): ")

    print("→ Conectando ao Garmin Connect...")
    try:
        client = Garmin(EMAIL, PASSWORD, prompt_mfa=mfa_prompt)
        client.login()
        print(f"  Logado como: {client.get_full_name()}")
        return client
    except GarminConnectAuthenticationError as e:
        print(f"  Erro de autenticação: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"  Erro inesperado: {e}")
        sys.exit(1)

# ── Helpers ────────────────────────────────────────────────────────────────────

def safe(fn, *args, default=None, **kwargs):
    """Chama fn silenciosamente, retorna default em caso de erro."""
    try:
        return fn(*args, **kwargs)
    except Exception as e:
        print(f"  [aviso] {fn.__name__}: {e}")
        return default


def round_or_none(val, decimals=2):
    try:
        return round(float(val), decimals)
    except (TypeError, ValueError):
        return None


def format_pace(seconds_per_meter):
    """Converte m/s para string mm:ss/km."""
    if not seconds_per_meter:
        return None
    spm = float(seconds_per_meter)
    if spm <= 0:
        return None
    sec_per_km = spm * 1000
    mins = int(sec_per_km // 60)
    secs = int(sec_per_km % 60)
    return f"{mins}:{secs:02d}/km"

# ── Coleta de dados ────────────────────────────────────────────────────────────

def fetch_activities(client):
    print("→ Buscando atividades de corrida...")
    all_acts = safe(
        client.get_activities_by_date,
        START_STR, TODAY_STR, "running",
        default=[]
    ) or []

    activities = []
    for act in all_acts:
        aid = act.get("activityId")

        # Splits por km (pace real de cada km)
        splits_raw = safe(client.get_activity_splits, aid, default={}) or {}
        splits = []
        for s in splits_raw.get("lapDTOs", []):
            dist = s.get("distance", 0)
            if dist and dist > 100:      # ignora splits muito curtos
                splits.append({
                    "km":           round_or_none(dist / 1000),
                    "pace":         format_pace(s.get("averageMovingSpeed")),
                    "avg_hr":       s.get("averageHR"),
                    "elevation_m":  round_or_none(s.get("elevationGain")),
                })

        # HR por zona
        hr_zones_raw = safe(client.get_activity_hr_in_timezones, aid, default=[]) or []
        hr_zones = [
            {
                "zone":       z.get("zoneNumber"),
                "time_min":   round_or_none((z.get("secsInZone") or 0) / 60),
                "pct":        round_or_none(z.get("zonePct")),
            }
            for z in hr_zones_raw
        ]

        dist_km  = round_or_none((act.get("distance") or 0) / 1000)
        dur_min  = round_or_none((act.get("duration") or 0) / 60)
        avg_spd  = act.get("averageSpeed")

        activities.append({
            "date":             act.get("startTimeLocal", "")[:10],
            "name":             act.get("activityName"),
            "distance_km":      dist_km,
            "duration_min":     dur_min,
            "avg_pace":         format_pace(avg_spd),
            "avg_hr":           act.get("averageHR"),
            "max_hr":           act.get("maxHR"),
            "calories":         act.get("calories"),
            "elevation_gain_m": act.get("elevationGain"),
            "training_effect_aerobic":   round_or_none(act.get("aerobicTrainingEffect")),
            "training_effect_anaerobic": round_or_none(act.get("anaerobicTrainingEffect")),
            "training_load":    round_or_none(act.get("activityTrainingLoad")),
            "vo2max_estimated": act.get("vO2MaxValue"),
            "avg_cadence":      act.get("averageRunningCadenceInStepsPerMinute"),
            "avg_stride_m":     round_or_none(act.get("avgStrideLength")),
            "hrv_sdrr_5":       act.get("summarizedDiveInfo"),   # proxy; pode ser None
            "splits_per_km":    splits,
            "hr_zones":         hr_zones,
        })

    print(f"  {len(activities)} atividades encontradas.")
    return activities


def fetch_weekly_load(client):
    print("→ Buscando carga semanal (training status)...")
    status = safe(client.get_training_status, START_STR, default={}) or {}
    readiness_list = []
    for entry in (status.get("trainingReadinessDTO") or []):
        readiness_list.append({
            "date":             entry.get("calendarDate"),
            "readiness_score":  entry.get("score"),
            "readiness_level":  entry.get("level"),
            "hrv_status":       entry.get("hrvStatus"),
            "sleep_score":      entry.get("sleepScore"),
            "recovery_time_h":  entry.get("recoveryTime"),
        })
    return readiness_list


def fetch_hrv(client):
    print("→ Buscando HRV...")
    results = []
    for i in range(DAYS_BACK):
        d = (TODAY - timedelta(days=i)).isoformat()
        hrv = safe(client.get_hrv_data, d, default=None)
        if hrv:
            summary = hrv.get("hrvSummary") or {}
            results.append({
                "date":          d,
                "weekly_avg":    summary.get("weeklyAvg"),
                "last_night":    summary.get("lastNight"),
                "status":        summary.get("status"),
                "5min_high":     summary.get("lastNight5MinHigh"),
            })
    return results


def fetch_sleep(client):
    print("→ Buscando dados de sono...")
    results = []
    for i in range(DAYS_BACK):
        d = (TODAY - timedelta(days=i)).isoformat()
        sleep = safe(client.get_sleep_data, d, default=None)
        if sleep:
            daily = sleep.get("dailySleepDTO") or {}
            results.append({
                "date":               d,
                "duration_h":         round_or_none((daily.get("sleepTimeSeconds") or 0) / 3600),
                "deep_min":           round_or_none((daily.get("deepSleepSeconds") or 0) / 60),
                "light_min":          round_or_none((daily.get("lightSleepSeconds") or 0) / 60),
                "rem_min":            round_or_none((daily.get("remSleepSeconds") or 0) / 60),
                "awake_min":          round_or_none((daily.get("awakeSleepSeconds") or 0) / 60),
                "sleep_score":        daily.get("sleepScores", {}).get("overall", {}).get("value"),
                "avg_overnight_hrv":  daily.get("avgOvernightHrv"),
                "avg_spo2":           daily.get("averageSpO2Value"),
                "avg_rhr":            daily.get("restingHeartRate"),
            })
    return results


def fetch_body_battery(client):
    print("→ Buscando Body Battery...")
    results = []
    for i in range(DAYS_BACK):
        d = (TODAY - timedelta(days=i)).isoformat()
        bb = safe(client.get_body_battery, d, d, default=None)
        if bb and isinstance(bb, list):
            charged = max((x.get("charged", 0) for x in bb), default=None)
            drained = max((x.get("drained", 0) for x in bb), default=None)
            results.append({
                "date":         d,
                "charged":      charged,
                "drained":      drained,
            })
    return results


def fetch_vo2max_and_race_predictions(client):
    print("→ Buscando VO2Max e previsões de prova...")
    metrics = safe(client.get_max_metrics, TODAY_STR, default={}) or {}
    race    = safe(client.get_race_predictions, default={}) or {}
    return {
        "vo2max_running":  metrics.get("vo2MaxPreciseValue"),
        "fitness_age":     metrics.get("fitnessAge"),
        "race_predictions": {
            "5k":    race.get("time5K"),
            "10k":   race.get("time10K"),
            "half":  race.get("timeHalfMarathon"),
            "full":  race.get("timeMarathon"),
        }
    }


def fetch_coach_plan(client):
    print("→ Buscando plano do Garmin Coach...")

    # Treinos agendados (próximas 8 semanas)
    end_schedule = (TODAY + timedelta(days=56)).isoformat()
    scheduled_raw = safe(client.get_scheduled_workouts, TODAY_STR, end_schedule, default=[]) or []

    scheduled = []
    for w in scheduled_raw:
        workout_id = w.get("workoutId")

        # Detalhes completos do workout (steps, targets de pace/FC)
        detail = {}
        if workout_id:
            raw_detail = safe(client.get_workout_by_id, workout_id, default={}) or {}
            steps = []
            for step in (raw_detail.get("workoutSegments") or []):
                for s in (step.get("workoutSteps") or []):
                    target = s.get("targetType", {})
                    end_cond = s.get("endCondition", {})
                    steps.append({
                        "type":           s.get("stepType", {}).get("displayOrder"),
                        "description":    s.get("description"),
                        "duration_type":  end_cond.get("conditionTypeKey"),
                        "duration_value": end_cond.get("conditionValue"),
                        "target_type":    target.get("conditionTypeKey"),
                        "target_low":     s.get("targetValueOne"),
                        "target_high":    s.get("targetValueTwo"),
                    })
            detail = {
                "workout_name": raw_detail.get("workoutName"),
                "sport":        raw_detail.get("sportType", {}).get("sportTypeKey"),
                "steps":        steps,
            }

        scheduled.append({
            "scheduled_date": w.get("date"),
            "workout_id":     workout_id,
            "title":          w.get("title") or detail.get("workout_name"),
            "sport":          w.get("sportTypeKey") or detail.get("sport"),
            "planned_distance_m": w.get("estimatedDistanceInMeters"),
            "planned_duration_s": w.get("estimatedDurationInSecs"),
            "detail":         detail,
        })

    # Planos de treino ativos
    plans_raw = safe(client.get_training_plans, default=[]) or []
    plans = []
    for p in plans_raw:
        if isinstance(p, str):
            plans.append({"raw": p})
            continue
        plans.append({
            "plan_id":       p.get("trainingPlanId"),
            "name":          p.get("trainingPlanName"),
            "start_date":    p.get("startDate"),
            "end_date":      p.get("endDate"),
            "goal":          p.get("goal"),
            "target_race":   p.get("targetRaceDate"),
            "fitness_level": p.get("fitnessLevel"),
            "weekly_runs":   p.get("numberOfRunsPerWeek"),
            "status":        p.get("planStatus"),
        })

    print(f"  {len(scheduled)} treinos agendados | {len(plans)} plano(s) ativo(s)")
    return {
        "active_plans":       plans,
        "scheduled_workouts": scheduled,
    }


def fetch_gear_stats(client):
    print("→ Buscando estatísticas de calçados...")
    gear_list = safe(client.get_gear, client.get_user_profile().get("displayName"), default=[]) or []
    gear_out = []
    for g in gear_list:
        if g.get("gearTypeName") == "shoes":
            gear_out.append({
                "name":          g.get("displayName"),
                "distance_km":   round_or_none((g.get("totalDistance") or 0) / 1000),
                "date_begin":    g.get("dateBegin"),
                "custom_km_max": g.get("maximumMeters") and round_or_none(g["maximumMeters"] / 1000),
            })
    return gear_out

# ── Main ───────────────────────────────────────────────────────────────────────

def main():
    client = login()

    profile = safe(client.get_user_profile, default={}) or {}

    print(f"\nColetando dados de {START_STR} até {TODAY_STR}...\n")

    data = {
        "meta": {
            "generated_at":  TODAY_STR,
            "period_days":   DAYS_BACK,
            "start_date":    START_STR,
            "end_date":      TODAY_STR,
            "display_name":  profile.get("displayName"),
        },
        "fitness": fetch_vo2max_and_race_predictions(client),
        "runs":    fetch_activities(client),
        "readiness_and_load": fetch_weekly_load(client),
        "hrv":          fetch_hrv(client),
        "sleep":        fetch_sleep(client),
        "body_battery": fetch_body_battery(client),
        "gear":         fetch_gear_stats(client),
        "coach_plan":   fetch_coach_plan(client),
    }

    out_file = "garmin_data.json"
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    coach = data["coach_plan"]
    print(f"\n✅ Pronto! Arquivo salvo: {out_file}")
    print(f"   Atividades:       {len(data['runs'])}")
    print(f"   Dias de HRV:      {len(data['hrv'])}")
    print(f"   Dias de sono:     {len(data['sleep'])}")
    print(f"   Planos ativos:    {len(coach['active_plans'])}")
    print(f"   Treinos agendados:{len(coach['scheduled_workouts'])}")
    print(f"\n→ Cole o conteúdo de '{out_file}' numa conversa com o Claude para análise.")


if __name__ == "__main__":
    main()