"use client";

import { Button } from "@/components/ui/button";
import Link from "next/link";
import Image from "next/image";
import CtaBg from "../../../public/cta-bg.png";

export function CtaSection() {
  return (
    <div className="mt-3 mb-4 relative overflow-hidden p-4 sm:p-6 md:p-8 lg:p-12 h-[400px] sm:h-[480px] md:h-[556px] flex flex-col rounded-3xl justify-center">
      <Image
        src={CtaBg}
        alt="CTA background"
        fill
        priority
        className="object-cover object-center"
        sizes="100vw"
      />
      {/* Dark overlay for better text contrast */}

      {/* Content */}
      <div className="relative text-center">
        <h2 className="text-2xl sm:text-3xl md:text-5xl font-medium text-white leading-tight md:leading-[58px] mb-3 sm:mb-4 md:mb-5">
          Your idea deserves <span className="font-playfair italic">to be live</span>
        </h2>
        <p className="text-sm sm:text-base text-white mb-6 sm:mb-8 md:mb-[50px] max-w-sm sm:max-w-md md:max-w-lg mx-auto px-2 sm:px-0">
          Join thousands of non-technical and experienced builders.
          <br />Everybody is welcome to build with Shipper & The Advisor!
        </p>
        <Button
          className="cta-gradient-button rounded-full px-6 sm:px-8 py-3 sm:py-4 text-base sm:text-lg font-bold h-[48px] sm:h-[54px] mx-auto"
          asChild
        >
          <Link href="#pricing">Start building your first app</Link>
        </Button>
      </div>
    </div>
  );
}
