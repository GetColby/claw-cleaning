import { pageHtml } from './page.js';

export const privacyMarkdown = `# Privacy Policy

*Last updated: 2026-04-16*

claw.cleaning (the "Service") is operated by Connor O'Brien ("we", "us"). This policy explains what data we collect when you book a cleaning, what we do with it, and how you can reach us about it.

## Summary

- We collect only the information you give us at checkout.
- We use it solely to fulfill your cleaning and send you a calendar invite.
- We never sell, rent, or share your information for marketing.
- We access Google Calendar only to write the cleaner's calendar events and send your invite — we do not read your calendar.

## Information we collect

When you book a cleaning, you provide:

- **Your name**
- **Your email address**
- **Your San Francisco street address**
- **The date, start time, and duration of the requested cleaning**

No payment information is collected by this Service. You pay the cleaner (cash or card) at the appointment.

We do not use cookies, analytics trackers, or ad pixels on this site.

## How we use information

We use the information above to:

1. Check availability against the cleaner's calendar.
2. Hold the requested time slot.
3. Create a calendar event for the cleaner and send a calendar invite to your email.
4. Contact you about your specific booking (e.g., a cancellation or on-the-day update).

We do not use your information for any other purpose.

## Google user data

This app uses Google's Calendar API in order to operate the Service.

- **Scope requested:** \`https://www.googleapis.com/auth/calendar.events\` on the cleaner's calendar only.
- **What we write:** one calendar event per confirmed booking (date, time, duration, your address, your name/email as invitee).
- **What we read:** only free/busy intervals on the cleaner's calendar, to determine whether a slot is available.
- **What we do NOT do:** we do not read, access, or store any calendar data from the customer's personal Google account. Customers do not sign in with Google to use this Service.
- **Retention:** calendar events are retained for as long as the cleaner keeps them on the cleaner's calendar. We do not copy or store them elsewhere.
- **Sharing:** Google user data is not shared with third parties, used for advertising, used to train AI models, or sold.

This app's use and transfer of information received from Google APIs adheres to the [Google API Services User Data Policy](https://developers.google.com/terms/api-services-user-data-policy), including the Limited Use requirements.

## Third-party services

We use the following processors strictly to deliver the Service:

- **Google Calendar** — to schedule the cleaner and send your calendar invite. See [Google's privacy policy](https://policies.google.com/privacy).
- **Cloudflare** — hosts the website and API. See [Cloudflare's privacy policy](https://www.cloudflare.com/privacypolicy/).

We do not share your information with any party other than these processors, and only as required to complete your booking.

## Data retention

- **Booking details** (name, email, address, date/time): captured as Google Calendar event metadata.
- **Calendar events**: retained on the cleaner's Google Calendar until removed.
- **Server logs** on Cloudflare: transient — typically discarded within 24 hours.

You can request deletion of your data at any time by emailing us (see below).

## Your rights

You may at any time:

- Request a copy of the information we hold about you.
- Request correction or deletion of that information.
- Withdraw consent and cancel an upcoming booking (subject to the cancellation window — see homepage).

Email us to exercise any of these rights. We will respond within 30 days.

## Security

- All traffic to claw.cleaning is served over HTTPS.
- No payment data is collected by this Service — all payments happen directly between you and the cleaner at the appointment.
- Google API credentials are stored as encrypted secrets and are never exposed to the browser.

## Children

This Service is not directed to children under 13, and we do not knowingly collect information from them.

## Changes to this policy

If we materially change this policy, we will update the "Last updated" date above and (for changes that affect how we use existing customer information) email previously-booked customers.

## Contact

Questions, access requests, or deletion requests:

**connor@getcolby.com**
`;

export function privacyHtml() {
  return pageHtml({
    title: 'Privacy Policy — claw.cleaning',
    description: 'Privacy policy for claw.cleaning, the AI-booked apartment cleaning service. Describes what data we collect, how we use Google Calendar, and your rights.',
    markdownPath: '/privacy.md',
    markdown: privacyMarkdown,
  });
}
