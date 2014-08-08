<?php
$config = require 'app_key.php';

$response = [];
$socketId = $_POST['socket_id'];
foreach($_POST['channel_name'] as $i => $channel){
    $status = ($channel === 'private-d')? 403 : 200;
    if(!isset($response[$socketId])) $response[$socketId] = [];
    $response[$socketId][$channel] = [
        'status' => $status,
        'data'   => array(
           'auth' => $config['key'] . ':' . hash_hmac( 'sha256', $socketId . ':' . $channel, $config['secret'], false)
        )
    ];
}

header('Content-Type: application/json');
exit(json_encode($response));