-- CreateTable
CREATE TABLE "daily_metrics" (
    "id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "steps" INTEGER,
    "active_calories" INTEGER,
    "floors_climbed" INTEGER,
    "resting_heart_rate_bpm" INTEGER,
    "min_heart_rate_bpm" INTEGER,
    "max_heart_rate_bpm" INTEGER,
    "stress_avg" INTEGER,
    "stress_max" INTEGER,
    "body_battery_charged" INTEGER,
    "body_battery_drained" INTEGER,
    "body_battery_max" INTEGER,
    "body_battery_min" INTEGER,
    "hrv_5min_high_ms" INTEGER,
    "hrv_weekly_avg_ms" INTEGER,
    "hrv_status" TEXT,
    "hrv_baseline_low_ms" INTEGER,
    "hrv_baseline_high_ms" INTEGER,
    "sleep_duration_s" INTEGER,
    "sleep_deep_s" INTEGER,
    "sleep_light_s" INTEGER,
    "sleep_rem_s" INTEGER,
    "sleep_awake_s" INTEGER,
    "sleep_score" INTEGER,
    "readiness_score" INTEGER,
    "readiness_level" TEXT,
    "recovery_time_min" INTEGER,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "daily_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activities" (
    "id" UUID NOT NULL,
    "garmin_activity_id" TEXT NOT NULL,
    "activity_type" TEXT NOT NULL,
    "sport" TEXT NOT NULL,
    "name" TEXT,
    "date" DATE NOT NULL,
    "started_at" TIMESTAMP NOT NULL,
    "started_at_gmt" TIMESTAMPTZ NOT NULL,
    "duration_s" DOUBLE PRECISION NOT NULL,
    "moving_duration_s" DOUBLE PRECISION,
    "distance_m" DOUBLE PRECISION,
    "avg_speed_mps" DOUBLE PRECISION,
    "max_speed_mps" DOUBLE PRECISION,
    "avg_hr_bpm" INTEGER,
    "max_hr_bpm" INTEGER,
    "calories" DOUBLE PRECISION,
    "elevation_gain_m" DOUBLE PRECISION,
    "elevation_loss_m" DOUBLE PRECISION,
    "avg_cadence_spm" DOUBLE PRECISION,
    "max_cadence_spm" DOUBLE PRECISION,
    "avg_stride_length_m" DOUBLE PRECISION,
    "training_effect_aerobic" DOUBLE PRECISION,
    "training_effect_anaerobic" DOUBLE PRECISION,
    "training_load" DOUBLE PRECISION,
    "vo2max_estimated" DOUBLE PRECISION,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_splits" (
    "id" UUID NOT NULL,
    "activity_id" UUID NOT NULL,
    "index" INTEGER NOT NULL,
    "distance_m" DOUBLE PRECISION,
    "duration_s" DOUBLE PRECISION,
    "avg_speed_mps" DOUBLE PRECISION,
    "avg_hr_bpm" INTEGER,
    "max_hr_bpm" INTEGER,
    "elevation_gain_m" DOUBLE PRECISION,

    CONSTRAINT "activity_splits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_hr_zones" (
    "id" UUID NOT NULL,
    "activity_id" UUID NOT NULL,
    "zone" INTEGER NOT NULL,
    "seconds_in_zone" DOUBLE PRECISION NOT NULL,
    "zone_low_bpm" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "activity_hr_zones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "race_predictions" (
    "id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "race_prediction_5k_s" INTEGER,
    "race_prediction_10k_s" INTEGER,
    "race_prediction_half_s" INTEGER,
    "race_prediction_full_s" INTEGER,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "race_predictions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_logs" (
    "id" UUID NOT NULL,
    "started_at" TIMESTAMPTZ NOT NULL,
    "finished_at" TIMESTAMPTZ,
    "status" TEXT NOT NULL,
    "period_start" DATE NOT NULL,
    "period_end" DATE NOT NULL,
    "records_processed" INTEGER NOT NULL DEFAULT 0,
    "error_message" TEXT,

    CONSTRAINT "sync_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "daily_metrics_date_key" ON "daily_metrics"("date");

-- CreateIndex
CREATE UNIQUE INDEX "activities_garmin_activity_id_key" ON "activities"("garmin_activity_id");

-- CreateIndex
CREATE INDEX "activities_date_idx" ON "activities"("date");

-- CreateIndex
CREATE INDEX "activities_sport_started_at_gmt_idx" ON "activities"("sport", "started_at_gmt");

-- CreateIndex
CREATE UNIQUE INDEX "activity_splits_activity_id_index_key" ON "activity_splits"("activity_id", "index");

-- CreateIndex
CREATE UNIQUE INDEX "activity_hr_zones_activity_id_zone_key" ON "activity_hr_zones"("activity_id", "zone");

-- CreateIndex
CREATE UNIQUE INDEX "race_predictions_date_key" ON "race_predictions"("date");

-- CreateIndex
CREATE INDEX "sync_logs_finished_at_idx" ON "sync_logs"("finished_at");

-- AddForeignKey
ALTER TABLE "activity_splits" ADD CONSTRAINT "activity_splits_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "activities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_hr_zones" ADD CONSTRAINT "activity_hr_zones_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "activities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
