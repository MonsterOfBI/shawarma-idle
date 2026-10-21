<?php
// Общая логика сервера VK для хостинга Beget (PHP). То же, что api/_vk.ts для Vercel.

function vk_config() {
  $f = __DIR__ . '/config.php';
  return is_file($f) ? require $f : ['app_secret' => '', 'service_token' => ''];
}

// Товары за голоса (1 голос = 7 ₽). Те же, что в api/_vk.ts.
$GLOBALS['VK_ITEMS'] = [
  'starter_pack' => ['title' => 'Стартовый набор', 'votes' => 7],
  'no_ads' => ['title' => 'Без рекламы', 'votes' => 14],
  'x2_forever' => ['title' => 'Доход ×2 навсегда', 'votes' => 21],
  'cash_pack' => ['title' => 'Мешок денег', 'votes' => 4],
  'god_pet' => ['title' => 'Брейнрот-бог', 'votes' => 21],
];

function vk_json($data, $status = 200) {
  http_response_code($status);
  header('Content-Type: application/json; charset=utf-8');
  echo json_encode($data, JSON_UNESCAPED_UNICODE);
}

function vk_cors() {
  header('Access-Control-Allow-Origin: *');
  header('Access-Control-Allow-Methods: POST, OPTIONS');
  header('Access-Control-Allow-Headers: Content-Type');
}

// Подпись уведомления о платеже: md5 от «ключ=значение» по алфавиту (без sig) плюс секрет.
function vk_payment_sig($p, $secret) {
  unset($p['sig']);
  ksort($p, SORT_STRING);
  $line = '';
  foreach ($p as $k => $v) $line .= $k . '=' . $v;
  return md5($line . $secret);
}

function vk_handle_payment($p, $secret) {
  if ($secret === '' || empty($p['sig']) || !hash_equals(vk_payment_sig($p, $secret), (string)$p['sig'])) {
    return ['error' => ['error_code' => 10, 'error_msg' => 'Несовпадение вычисленной и переданной подписи запроса.', 'critical' => true]];
  }
  $type = preg_replace('/_test$/', '', isset($p['notification_type']) ? $p['notification_type'] : '');
  if ($type === 'get_item') {
    $items = $GLOBALS['VK_ITEMS'];
    $key = isset($p['item']) ? $p['item'] : '';
    $item = isset($items[$key]) ? $items[$key] : null;
    if (!$item) return ['error' => ['error_code' => 20, 'error_msg' => 'Товара не существует.', 'critical' => true]];
    return ['response' => ['item_id' => $p['item'], 'title' => $item['title'], 'price' => $item['votes'], 'expiration' => 3600]];
  }
  if ($type === 'order_status_change') {
    if ((isset($p['status']) ? $p['status'] : '') !== 'chargeable') return ['error' => ['error_code' => 100, 'error_msg' => 'Передано непонятно что вместо chargeable.', 'critical' => true]];
    $id = (int)$p['order_id'];
    return ['response' => ['order_id' => $id, 'app_order_id' => $id]];
  }
  return ['error' => ['error_code' => 100, 'error_msg' => 'Неизвестный тип уведомления.', 'critical' => true]];
}

// Проверка параметров запуска (?vk_user_id=…&sign=…): HMAC-SHA256 от vk_*-параметров по алфавиту,
// base64url без «=». Возвращает id игрока или null.
function vk_check_launch($search, $secret) {
  parse_str(ltrim($search, '?'), $q);
  $sign = isset($q['sign']) ? $q['sign'] : '';
  $user = isset($q['vk_user_id']) ? $q['vk_user_id'] : '';
  if ($secret === '' || $sign === '' || $user === '') return null;
  $vk = [];
  foreach ($q as $k => $v) if (strpos($k, 'vk_') === 0) $vk[$k] = $v;
  ksort($vk, SORT_STRING);
  $line = http_build_query($vk, '', '&', PHP_QUERY_RFC1738);
  $want = rtrim(strtr(base64_encode(hash_hmac('sha256', $line, $secret, true)), '+/', '-_'), '=');
  return hash_equals($want, (string)$sign) ? (string)$user : null;
}
