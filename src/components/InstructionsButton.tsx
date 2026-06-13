"use client";

import { useState } from "react";

const SECTIONS = [
  {
    title: "What is this thing?",
    content: (
      <p>
        This tool allows fleet members to vote on media that plays in the background
        while a fleet is out doing its thing. Fleet members vote on the media they
        would like to play.
      </p>
    ),
  },
  {
    title: "Why do you need my ESI?",
    content: (
      <div className="space-y-3">
        <p>
          For the simple fact that there should be <strong>one fleet to one fleetr room.</strong>{" "}
          The bare minimum information required is just your identity, and a bit of
          data about your fleet, mainly the fleet ID.
        </p>
        <p>
          This app, like all of my apps, is designed with least privilege in mind. When
          you login, you first select the information you consent to this tool accessing,
          and then the tool redirects you to FCCP&apos;s OAuth portal, where you can
          confirm those choices. The tool will advise you if you access a feature that
          requires more access to your information.
        </p>
        <p>
          Fleet Membership is required so Fleetr can verify the one EVE fleet to one
          Fleetr room relationship. Location is optional and only powers solar-system
          display in the member roster. Fleet Sync is optional and is needed only if
          you want Fleetr to append the join link to your EVE fleet MOTD.
        </p>
        <p>
          ESI is <strong>sensitive, private and personal.</strong> Protect it, and only
          grant the bare minimum level of access to any tool that uses it.
        </p>
        <p className="italic">
          Also, for other ESI developers, for heaven&apos;s sake make sure you&apos;re
          verifying the client ID in granted tokens!
        </p>
      </div>
    ),
  },
  {
    title: "Quickstart",
    content: (
      <div className="space-y-3">
        <ol className="list-decimal space-y-1 pl-5">
          <li>Create a fleet in Eve Online</li>
          <li>Login to this tool, if not already</li>
          <li>Click Create Fleet and choose the media source for this fleet</li>
          <li>Copy the invitation link</li>
          <li>Distribute the invitation link to fleet members</li>
        </ol>
        <p>
          Optionally, under the Fleet Configuration tab, you can have the tool
          automatically insert a link into your fleet MOTD.
        </p>
        <p>
          Each Fleetr room uses one media source, either YouTube or SoundCloud. Queue
          submissions must match the source chosen when the room was created.
        </p>
      </div>
    ),
  },
  {
    title: "Set and Forget: This is a hands-off tool",
    content: (
      <p>
        This tool is designed to complement what you provide your fleet rather than
        serve as yet another distraction. Once you&apos;ve created the fleet and
        distributed the link, fleet members can vote on media to add to the queue. You
        can also delegate moderation controls to a fleet member. Check the Members List
        tab for this functionality.
      </p>
    ),
  },
  {
    title: "Voting",
    content: (
      <div className="space-y-3">
        <p>Top-voted media gets bumped to the top of the queue and will play next.</p>
        <p>
          Downvoted media falls down the queue. Votes and downvotes affect what plays
          next, not the track already playing. If the currently playing track is
          downvoted past the deletion threshold, Fleetr removes it and skips to the
          next track.
        </p>
        <p>
          The deletion threshold is configurable in Settings and is calculated from
          connected viewers, so pilots who close the app stop counting toward the vote
          denominator.
        </p>
      </div>
    ),
  },
  {
    title: "Battle Mode!",
    content: (
      <div className="space-y-3">
        <p>
          A separate queue, called Battle Mode, is available for fleet members to vote
          media into. When Battle Mode is enabled, playback is interrupted and swapped
          to the battle queue. Volume is also automatically reduced to a default 25% of
          what the player set; you, or a person you delegate, can change this setting
          in the Settings tab, or even silence playback entirely by setting it to 0%.
        </p>
        <p>This is basically where you put your boss music. <em>Sabaton mode engage!</em></p>
        <p>
          Toggling Battle Mode is done by pressing the Mode Switch button to the right
          of the FC&apos;s video player.
        </p>
      </div>
    ),
  },
  {
    title: "What about Ads?",
    content: (
      <div className="space-y-3">
        <p>
          Fleetr keeps a shared fleet reference track and start time. Each pilot&apos;s
          embedded player still runs locally, so ads, buffering, browser autoplay
          rules, or a local pause can make one person drift behind another.
        </p>
        <p>
          Use Catch Up to seek back to the fleet reference position. Mode switches and
          FC skips update the reference for everyone, but the player may finish a
          platform ad before it can load the new track.
        </p>
      </div>
    ),
  },
  {
    title: "Volume Control",
    content: (
      <p>
        Fleet volume can be controlled from one location. Note that this volume control
        sets the volume to a <strong>percentage</strong> of what the fleet member set
        locally. For instance, if their local player volume is 25%, and the FC sets the
        fleet volume from 100% to 20%, the fleet members&apos; actual volume gets
        reduced to 5%. This way we&apos;re not accidentally popping eardrums. Fleet
        members set their volume limit.
      </p>
    ),
  },
  {
    title: "Control Delegation",
    content: (
      <p>
        By default, only the <strong>Fleet Boss</strong> and the person occupying the{" "}
        <strong>Fleet Commander</strong> top-level position can control and moderate this
        tool. This authority can also be delegated to individuals within the fleet.
        Bosses, commanders, and delegates have the same fleet controls, except only
        the Fleet Boss and Fleet Commander can assign or remove delegation. When
        control is delegated, that user&apos;s interface will transform into the
        control interface.
      </p>
    ),
  },
  {
    title: "I like this tool!",
    content: (
      <div className="space-y-3">
        <p>
          If you like this tool, keep it in mind when the company you work for looks
          for a <strong>Platform Engineer / Staff Cloud Engineer / SRE / Release Engineer</strong>.
        </p>
        <p>
          I also graciously accept ISK donations, but cannot accept real money. RMT is
          bad, kay?
        </p>
      </div>
    ),
  },
];

export function InstructionsDialog({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="instructions-title"
    >
      <div className="max-h-[88vh] w-full max-w-3xl overflow-hidden rounded-lg border border-fleet-border bg-fleet-surface text-left shadow-2xl">
        <div className="flex items-center justify-between border-b border-fleet-border px-5 py-4">
          <h2 id="instructions-title" className="text-lg font-bold text-fleet-text">
            Instructions
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-fleet-text-muted transition-colors hover:bg-fleet-muted hover:text-fleet-text"
            aria-label="Close instructions"
          >
            <svg aria-hidden="true" viewBox="0 0 20 20" className="h-5 w-5">
              <path
                d="M5 5l10 10M15 5L5 15"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        <div className="max-h-[calc(88vh-64px)] overflow-y-auto px-5 py-4">
          <div className="divide-y divide-fleet-border">
            {SECTIONS.map((section, index) => (
              <details key={section.title} className="group py-2" open={index === 0}>
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded px-2 py-3 text-sm font-semibold text-fleet-text transition-colors hover:bg-fleet-muted [&::-webkit-details-marker]:hidden">
                  <span>{section.title}</span>
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 20 20"
                    className="h-4 w-4 shrink-0 text-fleet-accent transition-transform group-open:rotate-180"
                  >
                    <path
                      d="M5 8l5 5 5-5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </summary>
                <div className="px-2 pb-4 text-sm leading-6 text-fleet-text-muted">
                  {section.content}
                </div>
              </details>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function InstructionsButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs text-fleet-text-muted hover:text-fleet-text transition-colors"
      >
        Instructions
      </button>

      {open && <InstructionsDialog onClose={() => setOpen(false)} />}
    </>
  );
}
