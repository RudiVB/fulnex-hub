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
