"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/app/lib/supabaseClient";
import {
  isValidName,
  isValidPhone,
  isInRange,
  isValidMedicalCondition,
  isValidFitnessGoal,
  DIET_VALUES,
} from "@/app/lib/validators";

const DIET_OPTIONS = DIET_VALUES;

function optionalInRange(v, key) {
  if (v === "" || v === null || v === undefined) return true;
  return isInRange(v, key);
}

export default function AddClientModal({ onClose, onSaved }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [age, setAge] = useState("");
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  const [diet, setDiet] = useState("");
  const [medicalCondition, setMedicalCondition] = useState("");
  const [fitnessGoal, setFitnessGoal] = useState("");
  const [touched, setTouched] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const nameOk = isValidName(name);
  const phoneOk = isValidPhone(phone);
  const ageOk = optionalInRange(age, "age");
  const heightOk = optionalInRange(height, "height_cm");
  const weightOk = optionalInRange(weight, "weight_kg");
  const medicalOk = isValidMedicalCondition(medicalCondition);
  const goalOk = isValidFitnessGoal(fitnessGoal);
  const canSubmit = nameOk && phoneOk && ageOk && heightOk && weightOk && medicalOk && goalOk;

  function touch(field) {
    setTouched((t) => ({ ...t, [field]: true }));
  }

  function safeClose() {
    if (saving) return;
    onClose();
  }

  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape" && !saving) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [saving, onClose]);

  async function handleSubmit(e) {
    e.preventDefault();
    setTouched({ name: true, phone: true, age: true, height: true, weight: true, medicalCondition: true, fitnessGoal: true });
    if (!canSubmit) return;

    setSaving(true);
    setError(null);
    const { error: insertErr } = await supabase.from("clients").insert({
      name: name.trim(),
      phone: phone.trim(),
      age: age === "" ? null : Number(age),
      height_cm: height === "" ? null : Number(height),
      weight_kg: weight === "" ? null : Number(weight),
      diet: diet || null,
      medical_condition: medicalCondition.trim() || null,
      fitness_goal: fitnessGoal.trim() || null,
    });
    setSaving(false);

    if (insertErr) {
      setError(
        insertErr.message && insertErr.message.includes("duplicate")
          ? "A client with that phone number already exists."
          : "Could not save. Try again."
      );
      return;
    }

    onSaved();
    onClose();
  }

  return (
    <div className="modal-overlay" onClick={safeClose}>
      <motion.div
        className="modal-box"
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 8 }}
        transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="addClientTitle"
      >
        <h3 className="modal-title" id="addClientTitle">Add Client</h3>
        <p className="modal-sub">For a client you're onboarding directly — no payment or T&amp;C record will exist for them yet.</p>

        <form onSubmit={handleSubmit}>
          <div className={"field" + (touched.name && !nameOk ? " error" : "")}>
            <label htmlFor="addClientName">Full name</label>
            <input
              id="addClientName"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => touch("name")}
              disabled={saving}
              autoFocus
            />
            <p className="error-msg">Enter their full name (at least 2 letters).</p>
          </div>
          <div className={"field" + (touched.phone && !phoneOk ? " error" : "")}>
            <label htmlFor="addClientPhone">Phone number</label>
            <input
              id="addClientPhone"
              type="tel"
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              onBlur={() => touch("phone")}
              disabled={saving}
            />
            <p className="error-msg">Enter a valid 10-digit Indian mobile number.</p>
          </div>

          <div className="row2">
            <div className={"field" + (touched.age && !ageOk ? " error" : "")}>
              <label htmlFor="addClientAge">Age (optional)</label>
              <input
                id="addClientAge"
                type="number"
                inputMode="numeric"
                min={10}
                max={90}
                value={age}
                onChange={(e) => setAge(e.target.value)}
                onBlur={() => touch("age")}
                disabled={saving}
              />
              <p className="error-msg">Age must be between 10 and 90, or left blank.</p>
            </div>
            <div className={"field" + (touched.height && !heightOk ? " error" : "")}>
              <label htmlFor="addClientHeight">Height (cm, optional)</label>
              <input
                id="addClientHeight"
                type="number"
                inputMode="numeric"
                min={100}
                max={230}
                value={height}
                onChange={(e) => setHeight(e.target.value)}
                onBlur={() => touch("height")}
                disabled={saving}
              />
              <p className="error-msg">Height must be between 100 and 230 cm, or left blank.</p>
            </div>
          </div>

          <div className={"field" + (touched.weight && !weightOk ? " error" : "")}>
            <label htmlFor="addClientWeight">Weight (kg, optional)</label>
            <input
              id="addClientWeight"
              type="number"
              inputMode="decimal"
              step={0.5}
              min={25}
              max={250}
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              onBlur={() => touch("weight")}
              disabled={saving}
            />
            <p className="error-msg">Weight must be between 25 and 250 kg, or left blank.</p>
          </div>
          <div className="field">
            <label>Diet (optional)</label>
            <div className="pillgroup" role="group" aria-label="Diet" style={{ flexWrap: "wrap" }}>
              {DIET_OPTIONS.map((v) => (
                <div
                  key={v}
                  className={"pill" + (diet === v ? " selected" : "")}
                  role="button"
                  tabIndex={0}
                  aria-pressed={diet === v}
                  onClick={() => setDiet(diet === v ? "" : v)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setDiet(diet === v ? "" : v);
                    }
                  }}
                  style={{ flex: "1 1 auto", minWidth: 84 }}
                >
                  {v}
                </div>
              ))}
            </div>
          </div>

          <div className={"field" + (touched.medicalCondition && !medicalOk ? " error" : "")}>
            <label htmlFor="addClientMedical">Medical conditions (optional)</label>
            <textarea
              id="addClientMedical"
              rows={2}
              placeholder="e.g. knee injury, high BP, asthma"
              value={medicalCondition}
              onChange={(e) => setMedicalCondition(e.target.value)}
              onBlur={() => touch("medicalCondition")}
              disabled={saving}
            />
            <p className="error-msg">Keep it under {500} characters.</p>
          </div>

          <div className={"field" + (touched.fitnessGoal && !goalOk ? " error" : "")}>
            <label htmlFor="addClientGoal">Fitness goal (optional)</label>
            <textarea
              id="addClientGoal"
              rows={2}
              placeholder="e.g. weight loss, strength, general fitness"
              value={fitnessGoal}
              onChange={(e) => setFitnessGoal(e.target.value)}
              onBlur={() => touch("fitnessGoal")}
              disabled={saving}
            />
            <p className="error-msg">Keep it under {300} characters.</p>
          </div>

          {error && <p className="submit-error-msg show">{error}</p>}

          <div className="actions">
            <button type="button" className="btn btn-ghost" onClick={safeClose} disabled={saving}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving || !canSubmit}>
              {saving && <span className="spinner" aria-hidden="true" />}{saving ? "Saving…" : "Add Client"}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
