'use strict';

const axios = require('axios');
const payloads = require('./payloads');
const apiUrl = 'https://slack.com/api';
const approversChannelId = process.env.APPROVERS_CHANNEL;

/**
 * helper function to call POST methods of Slack API
 */
const callAPIMethodPost = async (method, payload) => {
  let result = await axios.post(`${apiUrl}/${method}`, payload, {
    headers: { Authorization: "Bearer " + process.env.SLACK_ACCESS_TOKEN }
  });
  return result.data;
}

/**
 * helper function to call GET methods of Slack API
 */
const callAPIMethodGet = async (method, payload) => {
  payload.token = process.env.SLACK_ACCESS_TOKEN
  let params = Object.keys(payload).map(key => `${key}=${payload[key]}`).join('&')
  let result = await axios.get(`${apiUrl}/${method}?${params}`);
  return result.data;
}

/**
 * helper function to receive all channels our bot user is a member of
 */
const getChannels = async (userId, channels, cursor) => {
  channels = channels || []

  let payload = {}
  if (cursor) payload.cursor = cursor
  let result = await callAPIMethodPost('users.conversations', payload)
  channels = channels.concat(result.channels)
  if (result.response_metadata && result.response_metadata.next_cursor && result.response_metadata.next_cursor.length)
    return getChannels(userId, channels, result.response_metadata.next_cursor)

  return channels
}

const requestAnnouncement = async (user, submission) => {
  // Send the approver a direct message with "Approve" and "Reject" buttons 
  submission.requester = user.id;
  submission.channel = approversChannelId;
  await callAPIMethodPost('chat.postMessage', payloads.approve(submission));
};

const rejectAnnouncement = async (payload, announcement) => {
  // 1. update the approver's message that this request has been denied
  await callAPIMethodPost('chat.update', {
    channel: payload.channel.id,
    ts: payload.message.ts,
    text: 'This request has been denied. I am letting the requester know!',
    blocks: null
  });

  // 2. send a notification to the requester
  let res = await callAPIMethodPost('conversations.open', {
    users: announcement.requester
  })
  await callAPIMethodPost('chat.postMessage', payloads.rejected({
    channel: res.channel.id,
    title: announcement.title,
    details: announcement.details,
    channelString: announcement.channelString
  }));
}

const postAnnouncement = async (payload, announcement) => {
  await callAPIMethodPost('chat.update', {
    channel: payload.channel.id,
    ts: payload.message.ts,
    text: 'Thanks! This post has been announced.',
    blocks: null
  });

  announcement.channels.forEach(channel => {
    callAPIMethodPost('chat.postMessage', payloads.announcement({
      channel: channel,
      title: announcement.title,
      details: announcement.details,
      requester: announcement.requester,
      approver: payload.user.id
    }));
  })
}



module.exports = {
  callAPIMethodPost,
  callAPIMethodGet,
  getChannels,
  rejectAnnouncement,
  postAnnouncement,
  requestAnnouncement
}
