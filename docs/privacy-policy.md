# MetaRadar Privacy Policy

Last updated: October 5, 2026

## Overview

MetaRadar is a Manifest V3 Chrome extension for inspecting basic on-page SEO and metadata. It processes selected information from the active web page locally on your device when you open its popup or request another check.

## What MetaRadar Does

MetaRadar reads selected information from the current page and displays understandable check results in its popup. It does not monitor browsing in the background or modify the page.

## Information Processed Locally

During a check, MetaRadar may read:

- The active page URL and document base URI, to identify the page and resolve relative canonical URLs.
- Page title, meta description, H1 text, canonical links, meta robots directives, and the HTML language attribute.
- Image counts and whether images have an alt attribute; it does not read alt text or download images.
- Open Graph metadata (`og:title`, `og:description`, and `og:image`) and hreflang language and link values.

This information and the check results are processed temporarily in local memory. They are not saved persistently, sent to the developer or an external server, or shared with third parties. Page text or URLs may themselves contain personal information; any such information within these selected fields receives the same local, temporary treatment.

MetaRadar uses this information only to provide its page inspection function. Its use of information accessed through Chrome APIs adheres to the Chrome Web Store User Data Policy, including the Limited Use requirements.

## Information Stored

The only persistent user preference is `themePreference` in `chrome.storage.local`. It represents System, Light, or Dark (stored as `system`, `light`, or `dark`) and controls the popup appearance. It is not synchronized using `chrome.storage.sync`.

## Information We Do Not Collect or Store

MetaRadar does not maintain browsing history, a list of visited websites, or a history of page metadata or check results. It has no user accounts or login system and does not request identity, health, payment, authentication, personal communication, or location information as separate data fields.

It does not read cookies, form inputs, or the full page HTML, or record clicks, keystrokes, mouse movements, or scrolling. These limits do not exclude personal information that a website may place in the selected page fields described above.

## Network Requests and Third Parties

The extension makes no external network requests and has no backend, external API, analytics, telemetry, tracking, advertising, or remotely hosted executable code. Metadata URLs are inspected as text, not fetched. MetaRadar does not sell personal information or other user data and does not share it with third parties.

## Chrome Permissions

- `activeTab`: temporary access to the active page after you invoke MetaRadar.
- `scripting`: runs the packaged, read-only page reader to obtain the selected page information locally.
- `storage`: saves only the theme preference.

MetaRadar requests no host permissions or `tabs`, `history`, `cookies`, or `webRequest` permission.

## Data Retention

Page information and results are held only for the popup session and are released when the popup closes; no persistent record is created. The theme preference remains until it is changed, the extension's local storage is cleared, or the extension is uninstalled. You can change it using the System, Light, and Dark buttons.

## Security

MetaRadar uses narrowly scoped permissions, packaged code, and text-only rendering of page values. It does not upload page information. These measures reduce exposure but do not guarantee absolute security.

## Children's Privacy

MetaRadar is not directed at children. It has no age registration or accounts. The same local processing and retention practices apply to all users.

## Changes to This Policy

This policy will be updated if MetaRadar's data practices change. The date above identifies the latest revision. Material changes to data handling will be prominently disclosed, and any consent required by Chrome Web Store policies will be obtained before the changed processing begins.

## Contact

For questions about this policy, contact: altunbeykoray07@gmail.com
