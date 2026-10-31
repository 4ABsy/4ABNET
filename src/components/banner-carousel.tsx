"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/components/providers";
import { ChevronLeftIcon, ChevronRightIcon } from "@/components/icons";

export type BannerData = {
  id: string;
  title: string;
  subtitle: string;
  ctaLabel: string;
  imageUrl: string | null;
  href: string | null;
};

export function BannerCarousel({ banners }: { banners: BannerData[] }) {
  const { t } = useI18n();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const count = banners.length;

  const slides = useMemo(() => banners.filter((banner) => banner.imageUrl), [banners]);

  useEffect(() => {
    if (slides.length <= 1 || paused) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => setIndex((current) => (current + 1) % slides.length), 6000);
    return () => window.clearInterval(timer);
  }, [slides.length, paused]);

  if (!slides.length) return null;
  const active = slides[index % slides.length];

  return (
    <section
      aria-roledescription="carousel"
      aria-label={t("home.featuredTitle")}
      className="container-page mt-6"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      <div className="relative overflow-hidden rounded-3xl border border-line bg-ink shadow-sm">
        <div key={active.id} className="animate-fade-in relative aspect-[16/7] min-h-[220px] w-full sm:aspect-[16/5]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={active.imageUrl!} alt={active.title} className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-ink/85 via-ink/20 to-transparent sm:bg-gradient-to-r sm:from-ink/80 sm:via-ink/30 sm:to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-5 text-white sm:p-10">
            <h2 className="max-w-2xl text-xl font-extrabold leading-8 sm:text-3xl">{active.title}</h2>
            {active.subtitle ? <p className="mt-1 max-w-xl text-xs leading-6 text-white/85 sm:text-sm">{active.subtitle}</p> : null}
            {active.href ? (
              <Link href={active.href} className="btn btn-primary mt-4">
                {active.ctaLabel || t("common.viewAll")}
              </Link>
            ) : null}
          </div>
        </div>

        {slides.length > 1 ? (
          <>
            <button
              type="button"
              onClick={() => setIndex((current) => (current - 1 + slides.length) % slides.length)}
              className="absolute start-3 top-1/2 -translate-y-1/2 rounded-full bg-white/85 p-2 text-ink shadow hover:bg-white"
              aria-label={t("common.previous")}
            >
              <ChevronLeftIcon size={18} className="icon-directional" />
            </button>
            <button
              type="button"
              onClick={() => setIndex((current) => (current + 1) % slides.length)}
              className="absolute end-3 top-1/2 -translate-y-1/2 rounded-full bg-white/85 p-2 text-ink shadow hover:bg-white"
              aria-label={t("common.next")}
            >
              <ChevronRightIcon size={18} className="icon-directional" />
            </button>
            <div className="absolute bottom-3 end-4 flex gap-1.5">
              {slides.map((slide, i) => (
                <button
                  key={slide.id}
                  type="button"
                  onClick={() => setIndex(i)}
                  aria-label={`${i + 1}`}
                  aria-current={i === index % slides.length}
                  className={`h-2 rounded-full transition-all ${
                    i === index % slides.length ? "w-6 bg-brand" : "w-2 bg-white/70 hover:bg-white"
                  }`}
                />
              ))}
            </div>
          </>
        ) : null}
      </div>
    </section>
  );
}
