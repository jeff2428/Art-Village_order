/**
 * line-bot.js
 * LINE Bot 推播模組
 * 職責：透過 LINE Messaging API 將訂單推播至內部群組
 */

/**
 * 發送訊息至 LINE 群組
 * @param {string} message - 訊息內容
 * @returns {Object} 發送結果
 */
function sendLineMessage(message) {
  try {
    var channelAccessToken = PropertiesService.getScriptProperties().getProperty('LINE_CHANNEL_ACCESS_TOKEN');
    var groupId = PropertiesService.getScriptProperties().getProperty('LINE_GROUP_ID');
    
    if (!channelAccessToken) {
      throw new Error('未設定 LINE_CHANNEL_ACCESS_TOKEN');
    }
    
    if (!groupId) {
      throw new Error('未設定 LINE_GROUP_ID');
    }
    
    var url = 'https://api.line.me/v2/bot/message/push';
    
    var payload = {
      to: groupId,
      messages: [
        {
          type: 'text',
          text: message
        }
      ]
    };
    
    var options = {
      method: 'post',
      contentType: 'application/json',
      headers: {
        'Authorization': 'Bearer ' + channelAccessToken,
        'Content-Type': 'application/json'
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };
    
    var response = UrlFetchApp.fetch(url, options);
    var responseCode = response.getResponseCode();
    
    if (responseCode === 200) {
      Logger.log('LINE 推播成功');
      return {
        success: true,
        message: '推播成功'
      };
    } else {
      var errorBody = response.getContentText();
      Logger.log('LINE 推播失敗 (' + responseCode + '): ' + errorBody);
      return {
        success: false,
        message: '推播失敗 (' + responseCode + '): ' + errorBody
      };
    }
    
  } catch (e) {
    Logger.log('sendLineMessage 錯誤: ' + e.toString());
    return {
      success: false,
      message: '推播異常: ' + e.toString()
    };
  }
}

/**
 * 發送多則訊息
 * @param {Array<Object>} messages - 訊息陣列 [{ type: 'text', text: '...' }]
 * @returns {Object} 發送結果
 */
function sendLineMultipleMessages(messages) {
  try {
    var channelAccessToken = PropertiesService.getScriptProperties().getProperty('LINE_CHANNEL_ACCESS_TOKEN');
    var groupId = PropertiesService.getScriptProperties().getProperty('LINE_GROUP_ID');
    
    if (!channelAccessToken || !groupId) {
      throw new Error('未設定 LINE 憑證');
    }
    
    var url = 'https://api.line.me/v2/bot/message/push';
    
    var payload = {
      to: groupId,
      messages: messages
    };
    
    var options = {
      method: 'post',
      contentType: 'application/json',
      headers: {
        'Authorization': 'Bearer ' + channelAccessToken,
        'Content-Type': 'application/json'
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };
    
    var response = UrlFetchApp.fetch(url, options);
    var responseCode = response.getResponseCode();
    
    if (responseCode === 200) {
      Logger.log('LINE 多則訊息推播成功');
      return { success: true };
    } else {
      Logger.log('LINE 多則訊息推播失敗: ' + response.getContentText());
      return { success: false, message: response.getContentText() };
    }
    
  } catch (e) {
    Logger.log('sendLineMultipleMessages 錯誤: ' + e.toString());
    return { success: false, message: e.toString() };
  }
}

/**
 * 發送 Flex Message（進階排版）
 * @param {Object} flexContent - Flex Message 內容
 * @returns {Object} 發送結果
 */
function sendLineFlexMessage(flexContent) {
  var message = {
    type: 'flex',
    altText: flexContent.altText || '新訂單通知',
    contents: flexContent.contents
  };
  
  return sendLineMultipleMessages([message]);
}

/**
 * 測試推播功能
 * 發送測試訊息至群組
 * @returns {Object} 測試結果
 */
function testLinePush() {
  var testMessage = '🔔 系統測試\n\n這是一則測試訊息，推播功能正常運作。';
  return sendLineMessage(testMessage);
}
