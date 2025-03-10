/**
 * @copyright Copyright (c) 2019 Marco Ambrosini <marcoambrosini@icloud.com>
 *
 * @author Marco Ambrosini <marcoambrosini@icloud.com>
 *
 * @license AGPL-3.0-or-later
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 *
 */
import Vue from 'vue'

import { getCurrentUser } from '@nextcloud/auth'
import { showInfo, showSuccess, showError, TOAST_PERMANENT_TIMEOUT } from '@nextcloud/dialogs'
import { emit } from '@nextcloud/event-bus'

import {
	CALL,
	CONVERSATION,
	PARTICIPANT,
	WEBINAR,
} from '../constants.js'
import BrowserStorage from '../services/BrowserStorage.js'
import {
	makePublic,
	makePrivate,
	setSIPEnabled,
	setRecordingConsent,
	changeLobbyState,
	changeReadOnlyState,
	changeListable,
	createOneToOneConversation,
	addToFavorites,
	removeFromFavorites,
	fetchConversations,
	fetchConversation,
	setConversationName,
	setConversationDescription,
	deleteConversation,
	clearConversationHistory,
	setConversationUnread,
	setNotificationLevel,
	setNotificationCalls,
	setConversationPermissions,
	setCallPermissions,
	setMessageExpiration,
	setConversationPassword,
	setConversationAvatar,
	setConversationEmojiAvatar,
	deleteConversationAvatar,
} from '../services/conversationsService.js'
import {
	startCallRecording,
	stopCallRecording,
} from '../services/recordingService.js'
import { talkBroadcastChannel } from '../services/talkBroadcastChannel.js'
import { useChatExtrasStore } from '../stores/chatExtras.js'
import { useReactionsStore } from '../stores/reactions.js'
import { useTalkHashStore } from '../stores/talkHash.js'

const DUMMY_CONVERSATION = {
	token: '',
	displayName: '',
	isFavorite: false,
	hasPassword: false,
	breakoutRoomMode: CONVERSATION.BREAKOUT_ROOM_MODE.NOT_CONFIGURED,
	breakoutRoomStatus: CONVERSATION.BREAKOUT_ROOM_STATUS.STOPPED,
	canEnableSIP: false,
	type: CONVERSATION.TYPE.PUBLIC,
	participantFlags: PARTICIPANT.CALL_FLAG.DISCONNECTED,
	participantType: PARTICIPANT.TYPE.USER,
	readOnly: CONVERSATION.STATE.READ_ONLY,
	listable: CONVERSATION.LISTABLE.NONE,
	hasCall: false,
	canStartCall: false,
	lobbyState: WEBINAR.LOBBY.NONE,
	lobbyTimer: 0,
	attendeePin: '',
	isDummyConversation: true,
}

/**
 * Emit global event for user status update with the status from a 1-1 conversation
 *
 * @param {object} conversation - a 1-1 conversation
 */
function emitUserStatusUpdated(conversation) {
	emit('user_status:status.updated', {
		status: conversation.status,
		message: conversation.statusMessage,
		icon: conversation.statusIcon,
		clearAt: conversation.statusClearAt,
		userId: conversation.name,
	})
}

const state = {
	conversations: {
	},
}

const getters = {
	conversations: state => state.conversations,
	/**
	 * List of all conversations sorted by isFavorite and lastActivity without breakout rooms
	 *
	 * @param {object} state state
	 * @return {object[]} sorted conversations list
	 */
	conversationsList: state => {
		return Object.values(state.conversations)
			// Filter out breakout rooms
			.filter(conversation => conversation.objectType !== CONVERSATION.OBJECT_TYPE.BREAKOUT_ROOM)
			// Sort by isFavorite and lastActivity
			.sort((conversation1, conversation2) => {
				if (conversation1.isFavorite !== conversation2.isFavorite) {
					return conversation1.isFavorite ? -1 : 1
				}
				return conversation2.lastActivity - conversation1.lastActivity
			})
	},
	/**
	 * Get a conversation providing its token
	 *
	 * @param {object} state state object
	 * @return {Function} The callback function returning the conversation object
	 */
	conversation: state => token => state.conversations[token],
	dummyConversation: state => Object.assign({}, DUMMY_CONVERSATION),
	isModerator: (state, getters, rootState, rootGetters) => {
		const conversation = getters.conversation(rootGetters.getToken())
		return conversation?.participantType === PARTICIPANT.TYPE.OWNER
				|| conversation?.participantType === PARTICIPANT.TYPE.MODERATOR
				|| conversation?.participantType === PARTICIPANT.TYPE.GUEST_MODERATOR
	},
	isModeratorOrUser: (state, getters, rootState, rootGetters) => {
		const conversation = getters.conversation(rootGetters.getToken())
		return !conversation?.isDummyConversation
			&& (getters.isModerator
				|| conversation?.participantType === PARTICIPANT.TYPE.USER
				|| conversation?.participantType === PARTICIPANT.TYPE.USER_SELF_JOINED)
	},
	isInLobby: (state, getters, rootState, rootGetters) => {
		const conversation = getters.conversation(rootGetters.getToken())
		return conversation
				&& conversation.lobbyState === WEBINAR.LOBBY.NON_MODERATORS
				&& !getters.isModerator
				&& (conversation.permissions & PARTICIPANT.PERMISSIONS.LOBBY_IGNORE) === 0
	},
}

const mutations = {
	/**
	 * Adds a conversation to the store.
	 *
	 * @param {object} state current store state;
	 * @param {object} conversation the conversation;
	 */
	addConversation(state, conversation) {
		Vue.set(state.conversations, conversation.token, conversation)
	},

	/**
	 * Update stored conversation
	 *
	 * @param {object} state the state
	 * @param {object} conversation the new conversation object
	 */
	updateConversation(state, conversation) {
		state.conversations[conversation.token] = conversation
	},

	/**
	 * Deletes a conversation from the store.
	 *
	 * @param {object} state current store state;
	 * @param {string} token the token of the conversation to delete;
	 */
	deleteConversation(state, token) {
		Vue.delete(state.conversations, token)
	},

	setConversationDescription(state, { token, description }) {
		Vue.set(state.conversations[token], 'description', description)
	},

	updateConversationLastReadMessage(state, { token, lastReadMessage }) {
		Vue.set(state.conversations[token], 'lastReadMessage', lastReadMessage)
	},

	updateConversationLastMessage(state, { token, lastMessage }) {
		Vue.set(state.conversations[token], 'lastMessage', lastMessage)
	},

	updateUnreadMessages(state, { token, unreadMessages, unreadMention, unreadMentionDirect }) {
		if (unreadMessages !== undefined) {
			Vue.set(state.conversations[token], 'unreadMessages', unreadMessages)
		}
		if (unreadMention !== undefined) {
			Vue.set(state.conversations[token], 'unreadMention', unreadMention)
		}
		if (unreadMentionDirect !== undefined) {
			Vue.set(state.conversations[token], 'unreadMentionDirect', unreadMentionDirect)
		}
	},

	setNotificationLevel(state, { token, notificationLevel }) {
		Vue.set(state.conversations[token], 'notificationLevel', notificationLevel)
	},

	setNotificationCalls(state, { token, notificationCalls }) {
		Vue.set(state.conversations[token], 'notificationCalls', notificationCalls)
	},

	setConversationPermissions(state, { token, permissions }) {
		Vue.set(state.conversations[token], 'defaultPermissions', permissions)
	},

	setCallPermissions(state, { token, permissions }) {
		Vue.set(state.conversations[token], 'callPermissions', permissions)
	},

	setCallRecording(state, { token, callRecording }) {
		Vue.set(state.conversations[token], 'callRecording', callRecording)
	},

	setMessageExpiration(state, { token, seconds }) {
		Vue.set(state.conversations[token], 'messageExpiration', seconds)
	},

	setConversationHasPassword(state, { token, hasPassword }) {
		Vue.set(state.conversations[token], 'hasPassword', hasPassword)
	},
}

const actions = {
	/**
	 * Add a conversation to the store and index the displayName
	 *
	 * @param {object} context default store context;
	 * @param {object} conversation the conversation;
	 */
	addConversation(context, conversation) {
		if (conversation.type === CONVERSATION.TYPE.ONE_TO_ONE) {
			emitUserStatusUpdated(conversation)
		}

		context.commit('addConversation', conversation)

		// Add current user to a new conversation participants
		let currentUser = {
			uid: context.getters.getUserId(),
			displayName: context.getters.getDisplayName(),
		}

		// Fallback to getCurrentUser() only if it has not been set yet (as
		// getCurrentUser() needs to be overridden in public share pages as it
		// always returns an anonymous user).
		if (!currentUser.uid) {
			currentUser = getCurrentUser()
		}
		context.dispatch('addParticipantOnce', {
			token: conversation.token,
			participant: {
				inCall: conversation.participantFlags,
				lastPing: conversation.lastPing,
				sessionIds: [conversation.sessionId],
				participantType: conversation.participantType,
				attendeeId: conversation.attendeeId,
				actorType: conversation.actorType,
				actorId: conversation.actorId, // FIXME check public share page handling
				userId: currentUser ? currentUser.uid : '',
				displayName: currentUser && currentUser.displayName ? currentUser.displayName : '', // TODO guest name from localstore?
			},
		})
	},

	/**
	 * Update conversation in store according to a new conversation object
	 *
	 * @param {object} context store context
	 * @param {object} conversation the new conversation object
	 * @return {boolean} whether the conversation was changed
	 */
	updateConversationIfHasChanged(context, conversation) {
		const oldConversation = context.state.conversations[conversation.token]

		// Update 1-1 conversation, if its status was changed
		if (conversation.type === CONVERSATION.TYPE.ONE_TO_ONE
			&& (oldConversation.status !== conversation.status
				|| oldConversation.statusMessage !== conversation.statusMessage
				|| oldConversation.statusIcon !== conversation.statusIcon
				|| oldConversation.statusClearAt !== conversation.statusClearAt
			)
		) {
			emitUserStatusUpdated(conversation)
			context.commit('updateConversation', conversation)
			return true
		}

		// Update conversation if lastActivity updated (e.g. new message came up, call state changed)
		if (oldConversation.lastActivity !== conversation.lastActivity) {
			context.commit('updateConversation', conversation)
			return true
		}

		// Check if any property were changed (no properties except status-related supposed to be added or deleted)
		for (const key of Object.keys(conversation)) {
			// "lastMessage" is the only property with non-primitive (object) value and cannot be compared by ===
			// If "lastMessage" was actually changed, it is already checked by "lastActivity"
			if (key !== 'lastMessage' && oldConversation[key] !== conversation[key]) {
				context.commit('updateConversation', conversation)
				return true
			}
		}

		return false
	},

	/**
	 * Delete a conversation from the store.
	 *
	 * @param {object} context default store context;
	 * @param {string} token the token of the conversation to be deleted;
	 */
	deleteConversation(context, token) {
		// FIXME: rename to deleteConversationsFromStore or a better name
		const chatExtrasStore = useChatExtrasStore()
		chatExtrasStore.purgeChatExtras(token)
		const reactionsStore = useReactionsStore()
		reactionsStore.purgeReactionsStore(token)
		context.dispatch('purgeMessagesStore', token)
		context.commit('deleteConversation', token)
		context.dispatch('purgeParticipantsStore', token)
		context.dispatch('cacheConversations')
	},

	/**
	 * Patch conversations:
	 * - Add new conversations
	 * - Remove conversations that are not in the new list
	 * - Update existing conversations
	 *
	 * @param {object} context default store context
	 * @param {object} payload the payload
	 * @param {object[]} payload.conversations new conversations list
	 * @param {boolean} payload.withRemoving whether to remove conversations that are not in the new list
	 * @param {boolean} payload.withCaching whether to cache conversations to BrowserStorage with patch
	 */
	patchConversations(context, { conversations, withRemoving = false, withCaching = false }) {
		let storeHasChanged = false

		const currentConversations = context.state.conversations
		const newConversations = Object.fromEntries(
			conversations.map((conversation) => [conversation.token, conversation])
		)

		// Remove conversations that are not in the new list
		if (withRemoving) {
			for (const token of Object.keys(currentConversations)) {
				if (newConversations[token] === undefined) {
					context.dispatch('deleteConversation', token)
					storeHasChanged = true
				}
			}
		}

		// Add new conversations and patch existing ones
		for (const [token, newConversation] of Object.entries(newConversations)) {
			if (currentConversations[token] === undefined) {
				context.dispatch('addConversation', newConversation)
				storeHasChanged = true
			} else {
				const conversationHasChanged = context.dispatch('updateConversationIfHasChanged', newConversation)
				storeHasChanged = conversationHasChanged || storeHasChanged
			}

			if (newConversation.objectType === CONVERSATION.OBJECT_TYPE.BREAKOUT_ROOM) {
				context.commit('addBreakoutRoom', {
					parentRoomToken: newConversation.objectId,
					breakoutRoom: newConversation,
				})
			}
		}

		if (withCaching && storeHasChanged) {
			context.dispatch('cacheConversations')
		}
	},

	/**
	 * Restores conversations from BrowserStorage and add them to the store state
	 *
	 * @param {object} context default store context
	 */
	restoreConversations(context) {
		const cachedConversations = BrowserStorage.getItem('cachedConversations')
		if (!cachedConversations?.length) {
			return
		}

		context.dispatch('patchConversations', {
			conversations: JSON.parse(cachedConversations),
			withRemoving: true,
		})

		console.debug('Conversations have been restored from BrowserStorage')
	},

	/**
	 * Save conversations to BrowserStorage from the store state
	 *
	 * @param {object} context default store context
	 */
	cacheConversations(context) {
		const conversations = context.getters.conversationsList
		if (!conversations.length) {
			return
		}

		const serializedConversations = JSON.stringify(conversations)
		BrowserStorage.setItem('cachedConversations', serializedConversations)
		console.debug(`Conversations were saved to BrowserStorage. Estimated object size: ${(serializedConversations.length / 1024).toFixed(2)} kB`)
	},

	/**
	 * Delete a conversation from the server.
	 *
	 * @param {object} context default store context;
	 * @param {object} data the wrapping object;
	 * @param {string} data.token the token of the conversation to be deleted;
	 */
	async deleteConversationFromServer(context, { token }) {
		await deleteConversation(token)
		// upon success, also delete from store
		await context.dispatch('deleteConversation', token)
		talkBroadcastChannel.postMessage({ message: 'force-fetch-all-conversations' })
	},

	/**
	 * Delete all the messages from a conversation.
	 *
	 * @param {object} context default store context;
	 * @param {object} data the wrapping object;
	 * @param {string} data.token the token of the conversation whose history is
	 * to be cleared;
	 */
	async clearConversationHistory(context, { token }) {
		try {
			const response = await clearConversationHistory(token)
			const chatExtrasStore = useChatExtrasStore()
			chatExtrasStore.removeParentIdToReply(token)
			const reactionsStore = useReactionsStore()
			reactionsStore.purgeReactionsStore(token)
			context.dispatch('purgeMessagesStore', token)
			return response
		} catch (error) {
			console.debug(
				t('spreed', 'Error while clearing conversation history'),
				error)
		}
	},

	async toggleGuests({ commit, getters }, { token, allowGuests }) {
		if (!getters.conversations[token]) {
			return
		}

		const conversation = Object.assign({}, getters.conversations[token])
		if (allowGuests) {
			await makePublic(token)
			conversation.type = CONVERSATION.TYPE.PUBLIC
		} else {
			await makePrivate(token)
			conversation.type = CONVERSATION.TYPE.GROUP
		}

		commit('addConversation', conversation)
	},

	async toggleFavorite({ commit, getters }, { token, isFavorite }) {
		if (!getters.conversations[token]) {
			return
		}

		// FIXME: logic is reversed
		if (isFavorite) {
			await removeFromFavorites(token)
		} else {
			await addToFavorites(token)
		}

		const conversation = Object.assign({}, getters.conversations[token], { isFavorite: !isFavorite })

		commit('addConversation', conversation)
	},

	async toggleLobby({ commit, getters }, { token, enableLobby }) {
		if (!getters.conversations[token]) {
			return
		}

		const conversation = Object.assign({}, getters.conversations[token])
		if (enableLobby) {
			await changeLobbyState(token, WEBINAR.LOBBY.NON_MODERATORS)
			conversation.lobbyState = WEBINAR.LOBBY.NON_MODERATORS
		} else {
			await changeLobbyState(token, WEBINAR.LOBBY.NONE)
			conversation.lobbyState = WEBINAR.LOBBY.NONE
		}

		commit('addConversation', conversation)
	},

	async setConversationName({ commit, getters }, { token, name }) {
		if (!getters.conversations[token]) {
			return
		}

		await setConversationName(token, name)

		const conversation = Object.assign({}, getters.conversations[token], { displayName: name })

		commit('addConversation', conversation)
	},

	async setConversationDescription({ commit }, { token, description }) {
		await setConversationDescription(token, description)
		commit('setConversationDescription', { token, description })
	},

	async setConversationPassword({ commit }, { token, newPassword }) {
		await setConversationPassword(token, newPassword)

		commit('setConversationHasPassword', {
			token,
			hasPassword: !!newPassword,
		})
	},

	async setReadOnlyState({ commit, getters }, { token, readOnly }) {
		if (!getters.conversations[token]) {
			return
		}

		await changeReadOnlyState(token, readOnly)

		const conversation = Object.assign({}, getters.conversations[token], { readOnly })

		commit('addConversation', conversation)
	},

	async setListable({ commit, getters }, { token, listable }) {
		if (!getters.conversations[token]) {
			return
		}

		await changeListable(token, listable)

		const conversation = Object.assign({}, getters.conversations[token], { listable })

		commit('addConversation', conversation)
	},

	async setLobbyTimer({ commit, getters }, { token, timestamp }) {
		if (!getters.conversations[token]) {
			return
		}

		const conversation = Object.assign({}, getters.conversations[token], { lobbyTimer: timestamp })

		// The backend requires the state and timestamp to be set together.
		await changeLobbyState(token, conversation.lobbyState, timestamp)

		commit('addConversation', conversation)
	},

	async setSIPEnabled({ commit, getters }, { token, state }) {
		if (!getters.conversations[token]) {
			return
		}

		await setSIPEnabled(token, state)

		const conversation = Object.assign({}, getters.conversations[token], { sipEnabled: state })

		commit('addConversation', conversation)
	},

	async setRecordingConsent({ commit, getters }, { token, state }) {
		if (!getters.conversations[token]) {
			return
		}

		await setRecordingConsent(token, state)

		const conversation = Object.assign({}, getters.conversations[token], { recordingConsent: state })

		commit('addConversation', conversation)
	},

	async setConversationProperties({ commit, getters }, { token, properties }) {
		if (!getters.conversations[token]) {
			return
		}

		const conversation = Object.assign({}, getters.conversations[token], properties)

		commit('addConversation', conversation)
	},

	async markConversationRead({ commit, getters }, token) {
		if (!getters.conversations[token]) {
			return
		}

		commit('updateUnreadMessages', { token, unreadMessages: 0, unreadMention: false, unreadMentionDirect: false })
	},

	async markConversationUnread({ commit, dispatch, getters }, { token }) {
		if (!getters.conversations[token]) {
			return
		}

		await setConversationUnread(token)
		commit('updateUnreadMessages', { token, unreadMessages: 1 })
		await dispatch('fetchConversation', { token })
	},

	async updateLastCommonReadMessage({ commit, getters }, { token, lastCommonReadMessage }) {
		if (!getters.conversations[token]) {
			return
		}

		const conversation = Object.assign({}, getters.conversations[token], { lastCommonReadMessage })

		commit('addConversation', conversation)
	},

	async updateConversationLastActive({ commit, getters }, token) {
		if (!getters.conversations[token]) {
			return
		}

		const conversation = Object.assign({}, getters.conversations[token], {
			lastActivity: (new Date().getTime()) / 1000,
		})

		commit('addConversation', conversation)
	},

	async updateConversationLastMessage({ commit }, { token, lastMessage }) {
		/**
		 * Only use the last message as lastMessage when:
		 * 1. It's not a command reply
		 * 2. It's not a temporary message starting with "/" which is a user posting a command
		 * 3. It's not a reaction or deletion of a reaction
		 * 3. It's not a deletion of a message
		 */
		if ((lastMessage.actorType !== 'bots'
				|| lastMessage.actorId === 'changelog')
			&& lastMessage.systemMessage !== 'reaction'
			&& lastMessage.systemMessage !== 'poll_voted'
			&& lastMessage.systemMessage !== 'reaction_deleted'
			&& lastMessage.systemMessage !== 'reaction_revoked'
			&& lastMessage.systemMessage !== 'message_deleted'
			&& !(typeof lastMessage.id.startsWith === 'function'
				&& lastMessage.id.startsWith('temp-')
				&& lastMessage.message.startsWith('/'))) {
			commit('updateConversationLastMessage', { token, lastMessage })
		}
	},

	async updateConversationLastMessageFromNotification({ getters, commit }, { notification }) {
		const [token, messageId] = notification.objectId.split('/')

		if (!getters.conversations[token]) {
			// Conversation not loaded yet, skipping
			return
		}

		const conversation = Object.assign({}, getters.conversations[token])

		const actor = notification.subjectRichParameters.user || notification.subjectRichParameters.guest || {
			type: 'guest',
			id: 'unknown',
			name: t('spreed', 'Guest'),
		}

		const lastMessage = {
			token,
			id: parseInt(messageId, 10),
			actorType: actor.type + 's',
			actorId: actor.id,
			actorDisplayName: actor.name,
			message: notification.messageRich,
			messageParameters: notification.messageRichParameters,
			timestamp: (new Date(notification.datetime)).getTime() / 1000,

			// Inaccurate but best effort from here on:
			expirationTimestamp: 0,
			isReplyable: true,
			messageType: 'comment',
			reactions: {},
			referenceId: '',
			systemMessage: '',
		}

		const unreadCounterUpdate = {
			token,
			unreadMessages: conversation.unreadMessages,
			unreadMention: conversation.unreadMention,
			unreadMentionDirect: conversation.unreadMentionDirect,
		}

		if (conversation.type === CONVERSATION.TYPE.ONE_TO_ONE) {
			unreadCounterUpdate.unreadMessages++
			unreadCounterUpdate.unreadMention++
			unreadCounterUpdate.unreadMentionDirect = true
		} else {
			unreadCounterUpdate.unreadMessages++
			Object.keys(notification.messageRichParameters).forEach(function(p) {
				const parameter = notification.messageRichParameters[p]
				if (parameter.type === 'user' && parameter.id === notification.user) {
					unreadCounterUpdate.unreadMention++
					unreadCounterUpdate.unreadMentionDirect = true
				} else if (parameter.type === 'call' && parameter.id === token) {
					unreadCounterUpdate.unreadMention++
				}
			})
		}
		conversation.lastActivity = lastMessage.timestamp

		commit('addConversation', conversation)
		commit('updateConversationLastMessage', { token, lastMessage })
		commit('updateUnreadMessages', unreadCounterUpdate)
	},

	async updateCallStateFromNotification({ getters, commit }, { notification }) {
		const token = notification.objectId

		if (!getters.conversations[token]) {
			// Conversation not loaded yet, skipping
			return
		}

		const activeSince = (new Date(notification.datetime)).getTime() / 1000

		// Check if notification information is older than in known conversation object
		if (activeSince < getters.conversations[token].lastActivity) {
			return
		}

		const conversation = Object.assign({}, getters.conversations[token], {
			hasCall: true,
			callFlag: PARTICIPANT.CALL_FLAG.WITH_VIDEO,
			activeSince,
			lastActivity: activeSince,
			callStartTime: activeSince,
		})

		// Inaccurate but best effort from here on:
		const lastMessage = {
			token,
			id: 'temp' + activeSince,
			actorType: 'guests',
			actorId: 'unknown',
			actorDisplayName: t('spreed', 'Guest'),
			message: notification.subjectRich,
			messageParameters: notification.subjectRichParameters,
			timestamp: activeSince,
			messageType: 'system',
			systemMessage: 'call_started',
			expirationTimestamp: 0,
			isReplyable: false,
			reactions: {},
			referenceId: '',
		}

		commit('updateConversationLastMessage', { token, lastMessage })
		commit('addConversation', conversation)
	},

	async updateConversationLastReadMessage({ commit }, { token, lastReadMessage }) {
		commit('updateConversationLastReadMessage', { token, lastReadMessage })
	},

	async overwriteHasCallByChat({ commit, dispatch }, { token, hasCall, lastActivity }) {
		dispatch('setConversationProperties', {
			token,
			properties: {
				hasCall,
				callFlag: hasCall ? PARTICIPANT.CALL_FLAG.IN_CALL : PARTICIPANT.CALL_FLAG.DISCONNECTED,
				lastActivity,
				callStartTime: hasCall ? lastActivity : 0,
			}
		})
	},

	async fetchConversation({ dispatch }, { token }) {
		const talkHashStore = useTalkHashStore()
		try {
			talkHashStore.clearMaintenanceMode()
			const response = await fetchConversation(token)
			talkHashStore.updateTalkVersionHash(response)
			dispatch('addConversation', response.data.ocs.data)
			return response
		} catch (error) {
			if (error?.response) {
				talkHashStore.checkMaintenanceMode(error.response)
			}
			throw error
		}
	},

	async fetchConversations({ dispatch }, { modifiedSince }) {
		const talkHashStore = useTalkHashStore()
		try {
			talkHashStore.clearMaintenanceMode()
			modifiedSince = modifiedSince || 0

			let options = {}
			if (modifiedSince !== 0) {
				options = {
					params: {
						modifiedSince,
					},
				}
			}

			const response = await fetchConversations(options)
			talkHashStore.updateTalkVersionHash(response)

			dispatch('patchConversations', {
				conversations: response.data.ocs.data,
				// Remove only when fetching a full list, not fresh updates
				withRemoving: modifiedSince === 0,
				withCaching: true,
			})

			// Inform other tabs about successful fetch
			talkBroadcastChannel.postMessage({
				message: 'update-conversations',
				conversations: response.data.ocs.data,
				withRemoving: modifiedSince === 0,
			})
			return response
		} catch (error) {
			if (error?.response) {
				talkHashStore.checkMaintenanceMode(error.response)
			}
			throw error
		}
	},

	async setNotificationLevel({ commit }, { token, notificationLevel }) {
		await setNotificationLevel(token, notificationLevel)

		commit('setNotificationLevel', { token, notificationLevel })
	},

	async setNotificationCalls({ commit }, { token, notificationCalls }) {
		await setNotificationCalls(token, notificationCalls)

		commit('setNotificationCalls', { token, notificationCalls })
	},

	/**
	 * Creates a new one to one conversation in the backend
	 * with the given actor then adds it to the store.
	 *
	 * @param {object} context default store context;
	 * @param {string} actorId actor id;
	 */
	async createOneToOneConversation(context, actorId) {
		const response = await createOneToOneConversation(actorId)
		const conversation = response.data.ocs.data
		context.dispatch('addConversation', conversation)

		return conversation
	},

	async setConversationPermissions(context, { token, permissions }) {
		await setConversationPermissions(token, permissions)
		context.commit('setConversationPermissions', { token, permissions })
	},

	async setMessageExpiration({ commit }, { token, seconds }) {
		await setMessageExpiration(token, seconds)
		commit('setMessageExpiration', { token, seconds })
	},

	async setCallPermissions(context, { token, permissions }) {
		await setCallPermissions(token, permissions)
		context.commit('setCallPermissions', { token, permissions })
	},

	async startCallRecording(context, { token, callRecording }) {
		try {
			await startCallRecording(token, callRecording)
		} catch (e) {
			console.error(e)
		}

		const startingCallRecording = callRecording === CALL.RECORDING.VIDEO ? CALL.RECORDING.VIDEO_STARTING : CALL.RECORDING.AUDIO_STARTING

		showSuccess(t('spreed', 'Call recording is starting.'))
		context.commit('setCallRecording', { token, callRecording: startingCallRecording })
	},

	async stopCallRecording(context, { token }) {
		const previousCallRecordingStatus = context.getters.conversation(token).callRecording

		try {
			await stopCallRecording(token)
		} catch (e) {
			console.error(e)
		}

		if (previousCallRecordingStatus === CALL.RECORDING.AUDIO_STARTING
			|| previousCallRecordingStatus === CALL.RECORDING.VIDEO_STARTING) {
			showInfo(t('spreed', 'Call recording stopped while starting.'))
		} else {
			showInfo(t('spreed', 'Call recording stopped. You will be notified once the recording is available.'), {
				timeout: TOAST_PERMANENT_TIMEOUT,
			})
		}
		context.commit('setCallRecording', { token, callRecording: CALL.RECORDING.OFF })
	},

	async setConversationAvatarAction(context, { token, file }) {
		try {
			const response = await setConversationAvatar(token, file)
			const conversation = response.data.ocs.data
			context.commit('addConversation', conversation)
			showSuccess(t('spreed', 'Conversation picture set'))
		} catch (error) {
			throw new Error(error.response?.data?.ocs?.data?.message ?? error.message)
		}
	},

	async setConversationEmojiAvatarAction(context, { token, emoji, color }) {
		try {
			const response = await setConversationEmojiAvatar(token, emoji, color)
			const conversation = response.data.ocs.data
			context.commit('addConversation', conversation)
			showSuccess(t('spreed', 'Conversation picture set'))
		} catch (error) {
			throw new Error(error.response?.data?.ocs?.data?.message ?? error.message)
		}
	},

	async deleteConversationAvatarAction(context, { token, file }) {
		try {
			const response = await deleteConversationAvatar(token, file)
			const conversation = response.data.ocs.data
			context.commit('addConversation', conversation)
			showSuccess(t('spreed', 'Conversation picture deleted'))
		} catch (error) {
			showError(t('spreed', 'Could not delete the conversation picture'))
		}
	},
}

export default { state, mutations, getters, actions }
