<?php
/**
 * Plugin Name: Demonfall Game
 * Description: Embeds the Demonfall ARPG prototype. Use the [demonfall] shortcode on any page (e.g. a page with slug "demonfall" → reachable at /demonfall).
 * Version: 1.0.0
 * Author: LeroyBächtold
 * License: GPL-2.0-or-later
 */

if (!defined('ABSPATH')) { exit; }

define('DEMONFALL_PLUGIN_URL', plugin_dir_url(__FILE__));
define('DEMONFALL_PLUGIN_PATH', plugin_dir_path(__FILE__));

/**
 * Shortcode: [demonfall]
 * Attributes:
 *   height — iframe height (default: 100vh for fullscreen; use e.g. "800px" for fixed)
 */
function demonfall_shortcode($atts) {
    $atts = shortcode_atts(array(
        'height' => '100vh',
    ), $atts, 'demonfall');

    $src = esc_url(DEMONFALL_PLUGIN_URL . 'game/index.html');
    $height = esc_attr($atts['height']);

    ob_start();
    ?>
    <div class="demonfall-embed" style="
        position: relative;
        width: 100%;
        height: <?php echo $height; ?>;
        margin: 0;
        padding: 0;
        overflow: hidden;
        background: #000;
    ">
        <iframe
            src="<?php echo $src; ?>"
            style="position:absolute; top:0; left:0; width:100%; height:100%; border:0;"
            allow="gamepad; fullscreen; autoplay; accelerometer; gyroscope; vibrate"
            loading="lazy"
            title="Demonfall">
        </iframe>
    </div>
    <?php
    return ob_get_clean();
}
add_shortcode('demonfall', 'demonfall_shortcode');

/**
 * Optional: remove WordPress theme chrome from the /demonfall page for a true
 * full-screen experience. Uncomment and adjust the page slug if desired.
 */
// add_filter('template_include', function($template) {
//     if (is_page('demonfall')) {
//         return DEMONFALL_PLUGIN_PATH . 'templates/fullscreen.php';
//     }
//     return $template;
// });
