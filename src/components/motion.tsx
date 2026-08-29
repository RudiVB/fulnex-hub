import { ReactNode, useEffect } from "react";
import {
  motion, useMotionValue, useSpring, useTransform,
} from "framer-motion";

export const easeOut = [0.22, 1, 0.36, 1] as const;

export function FadeUp({
  children, delay = 0, className,
}: { children: ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, delay, ease: easeOut }}
    >
      {children}
    </motion.div>
  );
}

export function Stagger({
  children, className, delay = 0,
}: { children: ReactNode; className?: string; delay?: number }) {
  return (
    <motion.div
      className={className}
      initial="hidden"
      animate="show"
      variants={{
        hidden: {},
        show: { transition: { staggerChildren: 0.07, delayChildren: delay } },
      }}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({
  children, className,
}: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      className={className}
      variants={{
        hidden: { opacity: 0, y: 16 },
        show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: easeOut } },
      }}
    >
      {children}
    </motion.div>
  );
}

export function AnimatedNumber({ value }: { value: number }) {
  const mv = useMotionValue(0);
  const spring = useSpring(mv, { stiffness: 90, damping: 20 });
  const display = useTransform(spring, (v) => Math.round(v).toLocaleString());
  useEffect(() => {
    mv.set(value);
  }, [value, mv]);
  return <motion.span>{display}</motion.span>;
}

export function LiveDot({ online }: { online: boolean }) {
  return (
    <span className="relative inline-flex w-2.5 h-2.5">
      {online && (
        <span className="absolute inset-0 rounded-full bg-white animate-ping opacity-50" />
      )}
      <span
        className={`relative w-2.5 h-2.5 rounded-full ${
          online ? "bg-white shadow-[0_0_12px_rgba(255,255,255,.85)]" : "bg-faint"
        }`}
      />
    </span>
  );
}

export function Reveal({
  children, delay = 0, className, y = 26,
}: { children: ReactNode; delay?: number; className?: string; y?: number }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.7, delay, ease: easeOut }}
    >
      {children}
    </motion.div>
  );
}

const shellBg =
  "radial-gradient(120% 120% at 30% 20%, #1d2024 0%, #141619 60%, #101214 100%)";

export function PuckMark({ size = 84 }: { size?: number }) {
  return (
    <div
      className="relative border border-[#2a2d32]"
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: shellBg,
        boxShadow: "0 18px 40px -22px rgba(0,0,0,.95), inset 0 1px 0 rgba(255,255,255,.06)",
      }}
    >
      <motion.span
        className="absolute rounded-full bg-white left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
        style={{ width: size * 0.05, height: size * 0.05, boxShadow: "0 0 10px 2px rgba(255,255,255,.55)" }}
        animate={{ opacity: [1, 0.35, 1] }}
        transition={{ duration: 4.2, repeat: Infinity, ease: "easeInOut" }}
      />
    </div>
  );
}

export function DoorMark({ width = 110 }: { width?: number }) {
  return (
    <div className="flex items-center gap-2">
      <div
        className="border border-[#2a2d32]"
        style={{
          width, height: width * 0.3, borderRadius: width * 0.09,
          background: shellBg,
          boxShadow: "0 14px 32px -20px rgba(0,0,0,.95), inset 0 1px 0 rgba(255,255,255,.06)",
        }}
      />
      <div
        className="border border-[#2a2d32]"
        style={{
          width: width * 0.3, height: width * 0.22, borderRadius: width * 0.06,
          background: shellBg,
          boxShadow: "0 10px 24px -16px rgba(0,0,0,.95)",
        }}
      />
    </div>
  );
}

export function SwitchMark({ size = 120 }: { size?: number }) {
  return (
    <div
      className="relative border border-[#2a2d32] flex items-center justify-center"
      style={{
        width: size, height: size * 0.66, borderRadius: size * 0.09,
        background: shellBg,
        boxShadow: "0 18px 40px -22px rgba(0,0,0,.95), inset 0 1px 0 rgba(255,255,255,.06)",
      }}
    >
      <span
        className="font-display text-[#0e1013] select-none"
        style={{ fontSize: size * 0.085, letterSpacing: "0.12em" }}
      >
        FULNEX
      </span>
      <span
        className="absolute bg-white rounded-full"
        style={{
          width: size * 0.035, height: size * 0.035, right: "14%", top: "18%",
          boxShadow: "0 0 8px 2px rgba(255,255,255,.5)",
        }}
      />
      <span
        className="absolute bg-[#26292e] rounded-b"
        style={{ width: size * 0.10, height: size * 0.10, bottom: -size * 0.09, left: "18%" }}
      />
    </div>
  );
}

export function DeviceMark({ size = 150 }: { size?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92, rotate: -2 }}
      animate={{ opacity: 1, scale: 1, rotate: 0 }}
      transition={{ duration: 0.9, ease: easeOut }}
      className="relative flex items-center justify-center border border-[#2a2d32]"
      style={{
        width: size,
        height: size,
        borderRadius: "22%",
        background:
          "radial-gradient(120% 120% at 30% 20%, #1d2024 0%, #141619 60%, #101214 100%)",
        boxShadow: "0 30px 60px -30px rgba(0,0,0,.9)",
      }}
    >
      <span
        className="font-display text-[#0e1013] select-none"
        style={{
          fontSize: size * 0.115,
          letterSpacing: "0.14em",
          textShadow: "0 1px 0 rgba(255,255,255,.07)",
        }}
      >
        FULNEX
      </span>
      <motion.span
        className="absolute rounded-full bg-white"
        style={{
          width: size * 0.045,
          height: size * 0.045,
          right: "16%",
          bottom: "16%",
          boxShadow: "0 0 14px 4px rgba(255,255,255,.6)",
        }}
        animate={{ opacity: [1, 0.35, 1] }}
        transition={{ duration: 3.6, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.span
        className="absolute inset-0 pointer-events-none"
        style={{
          borderRadius: "22%",
          background:
            "linear-gradient(115deg, transparent 35%, rgba(255,255,255,.09) 50%, transparent 65%)",
        }}
        initial={{ x: "-130%" }}
        animate={{ x: "130%" }}
        transition={{ duration: 3.2, repeat: Infinity, repeatDelay: 2.4, ease: "easeInOut" }}
      />
    </motion.div>
  );
}
