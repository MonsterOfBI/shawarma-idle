<?php
// Адрес для уведомлений о платежах VK: https://ВАШ-САЙТ/vk-payments.php (раздел «Платежи» в настройках VK).
require __DIR__ . '/vk.php';
vk_json(vk_handle_payment($_POST, vk_config()['app_secret']));
