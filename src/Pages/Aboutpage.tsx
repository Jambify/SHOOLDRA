/**
 * src/Pages/AboutPage.tsx
 * ───────────────────────────
 * Standalone /about route. Reuses the landing page's Navbar/Footer so
 * the shell feels consistent, but the content here is self-contained —
 * this isn't meant to be split into reorderable Landing/ components like
 * Hero or Pricing, since it's a single fixed narrative, not a section
 * that gets A/B tested.
 */

import React from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router";
import { motion } from "framer-motion";
import PageHelmet from "../components/SEO/PageHelmet";
import Navbar from "../components/Landing/NavBar";
import Footer from "../components/Landing/Footer";
import {
  Sparkles,
  Target,
  BookOpen,
  Sparkle,
  ShieldCheck,
  ArrowRight,
  Mail,
  Hand,
  X,
} from "lucide-react";
import { FaInstagram } from 'react-icons/fa';

const TIMELINE = [
  {
    period: "Where it started",
    title: "Someone close to me was overwhelmed by JAMB prep",
    body: "Random PDFs nobody organized. YouTube videos padded with ads. Past-question apps that just dump ten years of questions on you with no structure — nothing that actually helped them get better at what they were struggling with.",
  },
  {
    period: "What I built",
    title: "A smarter way to practice, made just for them",
    body: "A quiz engine that never repeats a question you've already seen today, gets a little harder or easier based on how you're really doing, and quietly tracks your weak topics — so you always know exactly what to study next.",
  },
  {
    period: "Today",
    title: "Now it's here for you too",
    body: "What started as a tool for one person has grown into a full platform — mock exams, thousands of real past questions, and an AI study mentor who's always ready to explain. Welcome to Schooldra 💙",
  },
];

const FEATURES = [
  {
    icon: Target,
    title: "Quizzes that grow with you",
    body: "Getting a little easier or harder based on how you're really doing — subject by subject, topic by topic.",
  },
  {
    icon: BookOpen,
    title: "Real past questions",
    body: "Thousands of genuine JAMB past questions from 2015–2025. Filter by subject, year, topic, or difficulty and start in seconds.",
  },
  {
    icon: Sparkle,
    title: "An AI mentor that explains",
    body: "Stuck on a question? It won't just mark it wrong — it walks you through why, so it actually sticks.",
  },
];

const FOUNDER = {
  name: "Shadrach",
  alternateName: "Shreda",
  title: "Founder & Builder of Schooldra",
  bio: "I'm Shadrach (also known as Shreda), a solo developer based in Lagos, Nigeria. I design, build, and maintain every part of Schooldra myself from the quiz engine to the backend powering it. I started this after watching someone close to me struggle through JAMB prep with nothing but scattered PDFs and ad-choked YouTube videos, and I've kept building it into a full exam-prep platform for Nigerian students ever since.",
};

// FIX: Store component references instead of mixed JSX elements / component pointers
const FOUNDER_SOCIALS = [
  {
    label: "Instagram",
    href: "https://www.instagram.com/shreda_shadrach",
    icon: FaInstagram,
  },
  {
    label: "X (Twitter)",
    href: "https://x.com/sha_dra_ch",
    icon: X,
  },
];

const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  visible: { opacity: 1, y: 0 },
};

const AboutPage: React.FC = () => {
  return (
    <>
      <PageHelmet
        title="About Schooldra — why we built this"
        description="Schooldra started as a tool built for one person prepping for JAMB. Here's the friendly story behind it, what it actually does, and who built it."
        canonical="https://www.schooldra.com/about"
      />

      <Helmet>
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Person",
            name: FOUNDER.name,
            alternateName: FOUNDER.alternateName,
            jobTitle: "Founder",
            description: FOUNDER.bio,
            url: "https://www.schooldra.com/about",
            worksFor: {
              "@type": "Organization",
              name: "Schooldra",
              url: "https://www.schooldra.com",
            },
            sameAs: FOUNDER_SOCIALS.map((s) => s.href),
          })}
        </script>
      </Helmet>

      <div className="bg-bgMain text-textMain min-h-screen">
        <Navbar />

        {/* ── Hero ── */}
        <section className="relative overflow-hidden px-4 pt-20 pb-16 sm:pt-28 sm:pb-20">
          <div
            className="ambient-glow pointer-events-none absolute inset-0"
            aria-hidden="true"
          />
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="relative mx-auto max-w-3xl text-center"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="border-brand/20 bg-brand/10 text-brand-light mb-6 inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-[11px] font-black tracking-widest uppercase"
            >
              <Sparkles size={13} />
              The story behind Schooldra
            </motion.div>
            <h1 className="font-display text-textMain text-center text-3xl leading-[1.15] font-black tracking-tight sm:text-5xl">
              JAMB preparation should feel focused, not overwhelming.{" "}
              <Hand className="text-brand inline-block h-[0.85em] w-[0.85em] origin-bottom-right align-baseline transition-transform hover:rotate-12" />
            </h1>

            <p className="text-textMuted mx-auto mt-6 max-w-xl text-base leading-relaxed sm:text-lg">
              Schooldra began with one student who needed a better way to
              practise. It became a focused study platform for anyone who wants
              to prepare with more direction and less noise.
            </p>
          </motion.div>
        </section>

        {/* ── Timeline ── */}
        <section className="px-4 pb-20">
          <div className="mx-auto max-w-3xl">
            <div className="space-y-8">
              {TIMELINE.map((item, i) => (
                <motion.div
                  key={item.title}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true, amount: 0.4 }}
                  variants={fadeUp}
                  transition={{ duration: 0.5, delay: i * 0.08 }}
                  className="flex gap-5 sm:gap-6"
                >
                  <div className="flex flex-col items-center">
                    <div className="bg-brand shadow-brand/30 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-black text-white shadow-lg">
                      {i + 1}
                    </div>
                    {i < TIMELINE.length - 1 && (
                      <div className="bg-borderMuted my-2 w-px flex-1" />
                    )}
                  </div>
                  <div className="pb-2">
                    <p className="text-brand-light mb-1 text-[11px] font-black tracking-widest uppercase">
                      {item.period}
                    </p>
                    <h3 className="font-display text-textMain mb-2 text-lg font-bold sm:text-xl">
                      {item.title}
                    </h3>
                    <p className="text-textMuted text-sm leading-relaxed sm:text-base">
                      {item.body}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ── What it actually does ── */}
        <section className="bg-bgSurface/40 border-borderMuted border-y px-4 py-16 sm:py-20">
          <div className="mx-auto max-w-4xl">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.5 }}
              variants={fadeUp}
              transition={{ duration: 0.5 }}
              className="mb-10 text-center"
            >
              <h2 className="font-display text-textMain text-2xl font-bold sm:text-3xl">
                What Schooldra actually does
              </h2>
              <p className="text-textDim mt-2 text-sm sm:text-base">
                Built around the moments that make preparation easier.
              </p>
            </motion.div>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
              {FEATURES.map((f, i) => (
                <motion.div
                  key={f.title}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true, amount: 0.4 }}
                  variants={fadeUp}
                  transition={{ duration: 0.5, delay: i * 0.1 }}
                  className="bg-bgCard border-borderMuted rounded-brand-xl border p-6"
                >
                  <div className="bg-brand/10 text-brand-light mb-4 flex h-11 w-11 items-center justify-center rounded-xl">
                    <f.icon size={20} />
                  </div>
                  <h3 className="font-display text-textMain mb-1.5 text-base font-bold">
                    {f.title}
                  </h3>
                  <p className="text-textMuted text-sm leading-relaxed">
                    {f.body}
                  </p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Trust note ── */}
        <motion.section
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.5 }}
          variants={fadeUp}
          transition={{ duration: 0.5 }}
          className="px-4 py-16 sm:py-20"
        >
          <div className="border-borderMuted bg-bgCard rounded-brand-2xl mx-auto flex max-w-3xl flex-col items-start gap-4 border p-7 sm:flex-row sm:items-center sm:p-8">
            <div className="bg-success/10 text-success flex h-11 w-11 shrink-0 items-center justify-center rounded-xl">
              <ShieldCheck size={20} />
            </div>
            <div className="flex-1">
              <h3 className="font-display text-textMain mb-1 text-base font-bold">
                Your data stays yours
              </h3>
              <p className="text-textMuted text-sm leading-relaxed">
                Schooldra is built and run by one person, not a faceless company
                — so you're never just a username to us. Your account, quiz
                history, and payment details are handled in line with Nigeria's
                Data Protection Act (NDPA).
              </p>
            </div>
            <Link
              to="/guest/privacy-policy"
              className="text-brand-light hover:text-brand shrink-0 text-sm font-bold whitespace-nowrap"
            >
              Read our Privacy Policy →
            </Link>
          </div>
        </motion.section>

        {/* ── Founder signature ── */}
        <motion.section
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.6 }}
          variants={fadeUp}
          transition={{ duration: 0.5 }}
          className="px-4 pb-4"
        >
          <div className="border-borderMuted bg-bgCard rounded-brand-2xl mx-auto max-w-2xl border p-7 text-center sm:p-8">
            <div className="bg-brand/10 text-brand-light mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl text-lg font-black">
              SH
            </div>
            <p className="font-display text-textMain text-base font-bold">
              {FOUNDER.name}
            </p>
            <p className="text-textDim mb-4 text-xs font-semibold tracking-wide uppercase">
              aka {FOUNDER.alternateName} — {FOUNDER.title}
            </p>
            <p className="text-textMuted mx-auto max-w-lg text-sm leading-relaxed">
              {FOUNDER.bio}
            </p>
            <div className="mt-5 flex items-center justify-center gap-3">
              {FOUNDER_SOCIALS.map((s) => {
                const IconComponent = s.icon;
                return (
                  <a
                    key={s.label}
                    href={s.href}
                    target="_blank"
                    rel="me noopener noreferrer"
                    aria-label={s.label}
                    className="border-borderMuted text-textDim hover:text-brand hover:border-brand/40 flex h-9 w-9 items-center justify-center rounded-full border transition-colors"
                  >
                    <IconComponent size={16} />
                  </a>
                );
              })}
            </div>
          </div>
        </motion.section>

        {/* ── Contact + close ── */}
        <section className="px-4 pb-20 text-center">
          <p className="text-textMuted mx-auto max-w-lg text-sm leading-relaxed sm:text-base">
            Schooldra is still being built with care and close attention to how
            students actually prepare. If something feels off or missing, we'd
            genuinely love to hear about it.
          </p>

          <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <a
              href="mailto:support@schooldra.com"
              className="text-textDim hover:text-textMain inline-flex items-center gap-2 text-sm font-semibold"
            >
              <Mail size={15} />
              support@schooldra.com
            </a>
          </div>

          <Link
            to="/signup"
            className="bg-brand hover:bg-brand-light shadow-brand/20 mt-8 inline-flex items-center gap-2 rounded-full px-7 py-3.5 text-sm font-bold text-white shadow-lg transition-all active:scale-95"
          >
            Start practicing free
            <ArrowRight size={16} />
          </Link>
        </section>

        <Footer />
      </div>
    </>
  );
};

export default AboutPage;