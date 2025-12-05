"use client";

import { useState } from "react";
import { motion } from "framer-motion";

type OnboardingGuideProps = {
  visible: boolean;
};

const STEPS = [
  {
    title: "Welcome to LifeWheel",
    description: "Start by rating your life areas and drag ideas into today.",
  },
  {
    title: "Connect Google Calendar",
    description: "Sync your day automatically so the inner watch ring reflects reality.",
  },
  {
    title: "Ask the Coach",
    description: "Speak or type ideas. The coach will classify, schedule, and keep you on pace.",
  },
];

export function OnboardingGuide({ visible }: OnboardingGuideProps) {
  const [step, setStep] = useState(0);

  if (!visible || step >= STEPS.length) {
    return null;
  }

  const current = STEPS[step];

  return (
    <motion.div
      className="pointer-events-auto fixed inset-x-4 bottom-8 z-40 mx-auto max-w-xl rounded-3xl border border-slate-200 bg-white/95 p-6 shadow-2xl backdrop-blur"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="flex flex-col gap-3 text-slate-900">
        <h2 className="text-lg font-semibold">{current.title}</h2>
        <p className="text-sm text-slate-600">{current.description}</p>
        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            {STEPS.map((_, idx) => (
              <span
                key={idx}
                className={`h-2 w-8 rounded-full ${idx === step ? "bg-slate-900" : "bg-slate-200"}`}
              />
            ))}
          </div>
          <div className="flex items-center gap-3">
            {step > 0 && (
              <button
                onClick={() => setStep((prev) => Math.max(prev - 1, 0))}
                className="text-xs font-medium text-slate-500"
              >
                Back
              </button>
            )}
            <button
              onClick={() => {
                if (step < STEPS.length - 1) {
                  setStep((prev) => prev + 1);
                } else {
                  setStep(STEPS.length);
                }
              }}
              className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-lg"
            >
              {step < STEPS.length - 1 ? "Next" : "Got it"}
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

