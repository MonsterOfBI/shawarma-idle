<?php
// Адрес для уведомлений о платежах VK: https://ВАШ-САЙТ/vk-payments.php (раздел «Платежи» в настройках VK).
require __DIR__ . '/vk.php';
$res = vk_handle_payment($_POST, vk_config()['app_secret']);
// Журнал платежей для проверки: vk-payments.log рядом со скриптом (наружу не отдаётся, см. .htaccess).
$type = isset($_POST['notification_type']) ? $_POST['notification_type'] : '?';
$item = isset($_POST['item']) ? $_POST['item'] : (isset($_POST['item_id']) ? $_POST['item_id'] : '');
$status = isset($_POST['status']) ? $_POST['status'] : '';
@file_put_contents(__DIR__ . '/vk-payments.log', date('c') . " $type $item $status → " . json_encode($res, JSON_UNESCAPED_UNICODE) . "\n", FILE_APPEND);
vk_json($res);
