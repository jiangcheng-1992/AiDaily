"use client";

import Image from "next/image";

const projects = [
  {
    id: "animals-protect",
    title: "万物生长",
    href: "https://animals-protect1-production.up.railway.app/",
    imageSrc: "/portfolio/banner-1.png",
  },
  {
    id: "lonely-prince",
    title: "孤独的小王子",
    href: "https://the-lonely-little-prince-production.up.railway.app/",
    imageSrc: "/portfolio/banner-2.png",
  },
  {
    id: "prompt-lookup",
    title: "提示词反查工具",
    href: "https://storyboard-ai-production.up.railway.app/",
    imageSrc: "/portfolio/banner-3.png",
  },
  {
    id: "mother-day",
    title: "母亲节拼图",
    href: "https://mother-day-production.up.railway.app/",
    imageSrc: "/portfolio/banner-4.png",
  },
];

export function PortfolioClient() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="grid gap-5 md:grid-cols-2">
        {projects.map((project) => (
          <a
            key={project.id}
            href={project.href}
            target="_blank"
            rel="noreferrer"
            className="group block overflow-hidden rounded-[2rem] shadow-soft transition-transform duration-200 hover:-translate-y-1 hover:shadow-lift"
          >
            <div className="relative aspect-[2/1] w-full overflow-hidden rounded-[2rem]">
              <Image
                src={project.imageSrc}
                alt={project.title}
                fill
                sizes="(min-width: 1024px) 560px, (min-width: 768px) 50vw, 100vw"
                quality={72}
                className="object-cover"
                priority={project.id === "animals-protect"}
              />
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
