import { Activity, Cross, Stethoscope } from "lucide-react";

export default function BrandMark() {
  return (
    <div className="flex items-center gap-3">
      <div className="relative grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-clinic-blue to-clinic-mint text-white shadow-soft">
        <Cross className="h-6 w-6" aria-hidden="true" />
        <Activity
          className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-white p-0.5 text-clinic-green"
          aria-hidden="true"
        />
      </div>
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold tracking-normal text-clinic-navy sm:text-3xl">
            QueueCure
          </h1>
          <Stethoscope className="h-5 w-5 text-clinic-blue" aria-hidden="true" />
        </div>
        <p className="mt-1 text-sm font-medium text-slate-500">
          Skip the Waiting Room. Track Your Turn Live.
        </p>
      </div>
    </div>
  );
}
