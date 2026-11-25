<?php
// 席替えし太郎：更新情報の配信（JSONP）
// 同じフォルダの changelog.json を読んで、アプリに渡します。
// アプリの script.js の CHANGELOG_JSON_URL に、このファイルのURLを書いてください。
// 例）https://example.com/sekigae/updates.php
// 新しいバージョンを出すときは、changelog.json だけを上書きします。

header('Content-Type: application/javascript; charset=utf-8');
header('Cache-Control: no-store');

$cb = isset($_GET['callback']) ? $_GET['callback'] : '';
if (!preg_match('/^[A-Za-z0-9_]{1,64}$/', $cb)) {
    http_response_code(400);
    echo '/* callback が正しくありません */';
    exit;
}

$file = __DIR__ . '/changelog.json';
$entries = [];
if (is_readable($file)) {
    $data = json_decode(file_get_contents($file), true);
    if (is_array($data)) $entries = array_values($data);
}
$res = ['found' => count($entries) > 0, 'entries' => $entries];
echo $cb . '(' . json_encode($res, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . ');';
