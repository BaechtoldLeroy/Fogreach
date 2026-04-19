=== Demonfall Game ===
Contributors: LeroyBächtold
Tags: game, arpg, phaser
Requires at least: 5.0
Tested up to: 6.5
Requires PHP: 7.2
Stable tag: 1.0.0
License: GPL-2.0-or-later

Embeds the Demonfall ARPG prototype via shortcode.

== Installation ==

1. Upload the demonfall folder to /wp-content/plugins/ (or upload the ZIP
   via Plugins → Add New → Upload Plugin).
2. Activate "Demonfall Game" via the Plugins screen.
3. Create a new WordPress Page, give it the slug "demonfall" (→ reachable
   at example.com/demonfall), and put the shortcode in the content:

       [demonfall]

   The game fills the viewport via iframe. Pass height="800px" for fixed
   embed, or height="100vh" (default) for fullscreen.

== Fullscreen without WP chrome ==

The shortcode works on any page, but the surrounding theme header/footer
will still be visible. For a true fullscreen experience, open
demonfall.php and uncomment the "template_include" filter at the bottom.
It serves templates/fullscreen.php when the page slug is "demonfall".

== Notes ==

- HTTPS is required for Audio and Vibration APIs.
- No external services or tracking. Save data is stored in the visitor's
  localStorage.
- Firebase leaderboard integration is optional and disabled by default.

== Changelog ==

= 1.0.0 =
* Initial release.
