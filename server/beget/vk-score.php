<?php
// Запись очков в таблицу игроков VK. Игра шлёт параметры запуска (с подписью VK) и число проданной шаурмы.
require __DIR__ . '/vk.php';
vk_cors();
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

$body = json_decode(file_get_contents('php://input'), true);
if (!is_array($body)) { vk_json(['ok' => false, 'error' => 'bad json'], 400); exit; }
$cfg = vk_config();
$user = vk_check_launch((string)($body['launch'] ?? ''), $cfg['app_secret']);
$score = is_numeric($body['score'] ?? null) ? (int)floor($body['score']) : -1;
if (!$user) { vk_json(['ok' => false, 'error' => 'bad sign'], 403); exit; }
if ($score < 0) { vk_json(['ok' => false, 'error' => 'bad score'], 400); exit; }
if ($cfg['service_token'] === '') { vk_json(['ok' => false, 'error' => 'no token'], 500); exit; }

$q = http_build_query([
  'user_id' => $user,
  'activity_id' => 2, // 2 — очки (таблица «по очкам» в настройках приложения)
  'value' => min($score, 2000000000),
  'access_token' => $cfg['service_token'],
  'client_secret' => $cfg['app_secret'],
  'v' => '5.199',
]);
$raw = @file_get_contents('https://api.vk.com/method/secure.addAppEvent?' . $q);
$data = json_decode($raw ?: '{}', true);
if (isset($data['error'])) vk_json(['ok' => false, 'error' => $data['error']['error_msg'] ?? 'vk error'], 502);
else vk_json(['ok' => true]);
