// Logo.js
import React, { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

import { twMerge } from "tailwind-merge";

const DELAY_IN_MS = 2500;
const TRANSITION_DURATION_IN_SECS = 1.5;

const AIOLogo = () => (
  <div className="text-md font-bold">AI</div>
);

const TienLogo = () => (
  <div className="text-sm font-bold">Tiến</div>
);

const DanhLogo = () => (
  <div className="text-sm font-bold">Danh</div>
);

const VuLogo = () => (
  <div className="text-sm font-bold">Vũ</div>
);

const ThienLogo = () => (
  <div className="text-sm font-bold">Thiên</div>
);

const BaoLogo = () => (
  <div className="text-sm font-bold">Bảo</div>
);

const LogoRolodex = ({ items }) => {
  const intervalRef = useRef(null);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setIndex((pv) => pv + 1);
    }, DELAY_IN_MS);

    return () => {
      clearInterval(intervalRef.current || undefined);
    };
  }, []);

  return (
    <div
      style={{
        transform: "rotateY(-20deg)",
        transformStyle: "preserve-3d",
        minWidth: "40px", // Cố định width
        minHeight: "40px", // Cố định height
        width: "40px",
        height: "40px",
        maxHeight: "40px",
        maxWidth: "40px"
      }}
      className="relative z-0 h-10 w-10 shrink-0 grow-0 rounded-md border border-neutral-700 bg-neutral-800" // Giảm kích thước để phù hợp sidebar
    >
      <AnimatePresence mode="sync">
        <motion.div
          style={{
            y: "-50%",
            x: "-50%",
            clipPath: "polygon(0 0, 100% 0, 100% 50%, 0 50%)",
            zIndex: -index,
            backfaceVisibility: "hidden",
          }}
          key={index}
          transition={{
            duration: TRANSITION_DURATION_IN_SECS,
            ease: "easeInOut",
          }}
          initial={{ rotateX: "0deg" }}
          animate={{ rotateX: "0deg" }}
          exit={{ rotateX: "-180deg" }}
          className="absolute left-1/2 top-1/2"
        >
          {items[index % items.length]}
        </motion.div>
        <motion.div
          style={{
            y: "-50%",
            x: "-50%",
            clipPath: "polygon(0 50%, 100% 50%, 100% 100%, 0 100%)",
            zIndex: index,
            backfaceVisibility: "hidden",
          }}
          key={(index + 1) * 2}
          initial={{ rotateX: "180deg" }}
          animate={{ rotateX: "0deg" }}
          exit={{ rotateX: "0deg" }}
          transition={{
            duration: TRANSITION_DURATION_IN_SECS,
            ease: "easeInOut",
          }}
          className="absolute left-1/2 top-1/2"
        >
          {items[index % items.length]}
        </motion.div>
      </AnimatePresence>

      <hr
        style={{
          transform: "translateZ(1px)",
        }}
        className="absolute left-0 right-0 top-1/2 z-[999999999] -translate-y-1/2 border-t border-neutral-800"
      />
    </div>
  );
};

const LogoItem = ({ children, className }) => {
  return (
    <div
      className={twMerge(
        "flex items-center justify-center grow-0 h-10 w-10 rounded-md bg-neutral-700 text-xl text-neutral-50", // Giảm kích thước cho sidebar
        className
      )}
    >
      {children}
    </div>
  );
};

// Export component Logo để dùng trong sidebar
const SidebarLogo = () => {
  return (
    <LogoRolodex
      items={[
        <LogoItem key={1} className="bg-white text-lime-700">
          <AIOLogo />
        </LogoItem>,
        <LogoItem key={2} className="bg-green-400 text-indigo-800">
          <TienLogo />
        </LogoItem>,
        <LogoItem key={3} className="bg-yellow-300 text-indigo-800">
          <BaoLogo />
        </LogoItem>,
        <LogoItem key={4} className="bg-purple-600 text-yellow-300">
          <DanhLogo />
        </LogoItem>,
        <LogoItem key={5} className="bg-red-600 text-neutral-100">
          <VuLogo />
        </LogoItem>,
        <LogoItem key={6} className="bg-purple-300 text-neutral-900">
          <ThienLogo />
        </LogoItem>,
      ]}
    />
  );
};

export default SidebarLogo;
