<?php
// Запись очков в таблицу игроков VK. Игра шлёт параметры запуска (с подписью VK) и число проданной шаурмы.
require __DIR__ . '/vk.php';
vk_cors();
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

$raw = file_get_contents('php://input', false, null, 0, 8192);
$body = json_decode($raw, true);
if (!is_array($body)) { vk_json(['ok' => false, 'error' => 'bad json'], 400); exit; }
$cfg = vk_config();
$user = vk_check_launch((string)(isset($body['launch']) ? $body['launch'] : ''), $cfg['app_secret']);
$score = (isset($body['score']) && is_numeric($body['score'])) ? (int)floor($body['score']) : -1;
if (!$user) { vk_json(['ok' => false, 'error' => 'bad sign'], 403); exit; }
if ($score < 0) { vk_json(['ok' => false, 'error' => 'bad score'], 400); exit; }
// Не чаще раза в 15 секунд от одного игрока (игра шлёт очки раз в минуту), лишнее отбрасываем.
if (!vk_rate_ok($user, 15)) { vk_json(['ok' => false, 'error' => 'too often'], 429); exit; }
if ($cfg['service_token'] === '') { vk_json(['ok' => false, 'error' => 'no token'], 500); exit; }

$q = http_build_query([
  'user_id' => $user,
  'activity_id' => 2, // 2 — очки (таблица «по очкам» в настройках приложения)
  'value' => min($score, 10000000), // VK принимает очки до 10 млн
  'access_token' => $cfg['service_token'],
  'client_secret' => $cfg['app_secret'],
  'v' => '5.199',
]);
$raw = @file_get_contents('https://api.vk.com/method/secure.addAppEvent?' . $q);
$data = json_decode($raw ?: '{}', true);
if (isset($data['error'])) vk_json(['ok' => false, 'error' => isset($data['error']['error_msg']) ? $data['error']['error_msg'] : 'vk error'], 502);
else vk_json(['ok' => true]);
