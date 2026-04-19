<?php
/**
 * Full-screen template for the Demonfall page. Served instead of the normal
 * theme layout when the "template_include" filter in demonfall.php is
 * enabled. Strips all WP chrome so the game fills the viewport.
 */

if (!defined('ABSPATH')) { exit; }
?>
<!DOCTYPE html>
<html <?php language_attributes(); ?>>
<head>
    <meta charset="<?php bloginfo('charset'); ?>">
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">
    <title>Demonfall</title>
    <style>
        html, body { margin:0; padding:0; width:100%; height:100%; overflow:hidden; background:#000; }
        iframe { position:fixed; inset:0; width:100%; height:100%; border:0; }
    </style>
</head>
<body>
    <iframe
        src="<?php echo esc_url(DEMONFALL_PLUGIN_URL . 'game/index.html'); ?>"
        allow="gamepad; fullscreen; autoplay; accelerometer; gyroscope; vibrate"
        title="Demonfall">
    </iframe>
</body>
</html>
