<!--
  - @copyright Copyright (c) 2024 Maksim Sukharev <antreesy.web@gmail.com>
  -
  - @author Maksim Sukharev <antreesy.web@gmail.com>
  - @author Marco Ambrosini <marcoambrosini@icloud.com>
  -
  - @license AGPL-3.0-or-later
  -
  - This program is free software: you can redistribute it and/or modify
  - it under the terms of the GNU Affero General Public License as
  - published by the Free Software Foundation, either version 3 of the
  - License, or (at your option) any later version.
  -
  - This program is distributed in the hope that it will be useful,
  - but WITHOUT ANY WARRANTY; without even the implied warranty of
  - MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
  - GNU Affero General Public License for more details.
  -
  - You should have received a copy of the GNU Affero General Public License
  - along with this program. If not, see <http://www.gnu.org/licenses/>.
-->

<template>
	<div ref="messageMain" class="message-main">
		<!-- System or deleted message body content -->
		<div v-if="isSystemMessage || isDeletedMessage"
			class="message-main__text"
			:class="{
				'system-message': isSystemMessage && !showJoinCallButton,
				'deleted-message': isDeletedMessage,
				'call-started': showJoinCallButton,
			}">
			<!-- Message content / text -->
			<CancelIcon v-if="isDeletedMessage" :size="16" />
			<NcRichText :text="renderedMessage"
				:arguments="richParameters"
				autolink
				dir="auto"
				:reference-limit="0" />

			<!-- Additional controls -->
			<CallButton v-if="showJoinCallButton" />
			<Poll v-if="showResultsButton"
				v-bind="messageParameters.poll"
				:token="token"
				show-as-button />
		</div>

		<!-- Normal message body content -->
		<div v-else
			class="message-main__text markdown-message"
			@mouseover="handleMarkdownMouseOver"
			@mouseleave="handleMarkdownMouseLeave">
			<!-- Replied parent message -->
			<Quote v-if="parent" v-bind="parent" />

			<!-- Message content / text -->
			<NcRichText :text="renderedMessage"
				:arguments="richParameters"
				:class="{'single-emoji': isSingleEmoji}"
				autolink
				dir="auto"
				:use-markdown="markdown"
				:reference-limit="1" />

			<!-- Additional controls -->
			<NcButton v-if="containsCodeBlocks"
				v-show="currentCodeBlock !== null"
				class="message-copy-code"
				type="tertiary"
				:aria-label="t('spreed', 'Copy code block')"
				:title="t('spreed', 'Copy code block')"
				:style="{top: copyButtonOffset}"
				@click="copyCodeBlock">
				<template #icon>
					<ContentCopyIcon :size="16" />
				</template>
			</NcButton>
		</div>

		<!-- Additional message info-->
		<div v-if="!isDeletedMessage" class="message-main__info">
			<span v-if="!hideDate" class="date" :title="messageDate">{{ messageTime }}</span>

			<!-- Message delivery status indicators -->
			<div v-if="sendingFailure"
				:title="sendingErrorIconTooltip"
				class="message-status sending-failed"
				:class="{'retry-option': sendingErrorCanRetry}"
				:aria-label="sendingErrorIconTooltip"
				tabindex="0"
				@mouseover="showReloadButton = true"
				@focus="showReloadButton = true"
				@mouseleave="showReloadButton = false"
				@blur="showReloadButton = false">
				<NcButton v-if="sendingErrorCanRetry && showReloadButton"
					:aria-label="sendingErrorIconTooltip"
					@click="handleRetry">
					<template #icon>
						<ReloadIcon :size="16" />
					</template>
				</NcButton>
				<AlertCircleIcon v-else :size="16" />
			</div>
			<div v-else-if="showLoadingIcon"
				:title="loadingIconTooltip"
				class="icon-loading-small message-status"
				:aria-label="loadingIconTooltip" />
			<div v-else-if="showCommonReadIcon"
				:title="commonReadIconTooltip"
				class="message-status"
				:aria-label="commonReadIconTooltip">
				<CheckAllIcon :size="16" />
			</div>
			<div v-else-if="showSentIcon"
				:title="sentIconTooltip"
				class="message-status"
				:aria-label="sentIconTooltip">
				<CheckIcon :size="16" />
			</div>
		</div>
	</div>
</template>

<script>
import emojiRegex from 'emoji-regex'

import AlertCircleIcon from 'vue-material-design-icons/AlertCircle.vue'
import CancelIcon from 'vue-material-design-icons/Cancel.vue'
import CheckIcon from 'vue-material-design-icons/Check.vue'
import CheckAllIcon from 'vue-material-design-icons/CheckAll.vue'
import ContentCopyIcon from 'vue-material-design-icons/ContentCopy.vue'
import ReloadIcon from 'vue-material-design-icons/Reload.vue'

import { showError, showSuccess } from '@nextcloud/dialogs'
import moment from '@nextcloud/moment'

import NcButton from '@nextcloud/vue/dist/Components/NcButton.js'
import NcRichText from '@nextcloud/vue/dist/Components/NcRichText.js'

import Poll from './Poll.vue'
import Quote from '../../../../Quote.vue'
import CallButton from '../../../../TopBar/CallButton.vue'

import { useIsInCall } from '../../../../../composables/useIsInCall.js'
import { EventBus } from '../../../../../services/EventBus.js'

// Regular expression to check for Unicode emojis in message text
const regex = emojiRegex()

export default {
	name: 'MessageBody',

	components: {
		CallButton,
		NcButton,
		NcRichText,
		Poll,
		Quote,
		// Icons
		AlertCircleIcon,
		CancelIcon,
		CheckIcon,
		CheckAllIcon,
		ContentCopyIcon,
		ReloadIcon,
	},

	inheritAttrs: false,

	props: {
		id: {
			type: [String, Number],
			required: true,
		},
		token: {
			type: String,
			required: true,
		},
		parent: {
			type: Object,
			default: undefined,
		},
		markdown: {
			type: Boolean,
			default: true,
		},
		message: {
			type: String,
			required: true,
		},
		messageType: {
			type: String,
			required: true,
		},
		systemMessage: {
			type: String,
			required: true,
		},
		messageParameters: {
			type: [Array, Object],
			required: true,
		},
		richParameters: {
			type: Object,
			required: true,
		},
		timestamp: {
			type: Number,
			default: 0,
		},
		isDeleting: {
			type: Boolean,
			default: false,
		},
		isTemporary: {
			type: Boolean,
			default: false,
		},
		hasCall: {
			type: Boolean,
			default: false,
		},
		sendingFailure: {
			type: String,
			default: '',
		},

		/**
		 * Message read information
		 */
		showCommonReadIcon: {
			type: Boolean,
			required: true,
		},
		commonReadIconTooltip: {
			type: String,
			required: true,
		},
		showSentIcon: {
			type: Boolean,
			required: true,
		},
		sentIconTooltip: {
			type: String,
			required: true,
		},
	},

	setup() {
		return {
			isInCall: useIsInCall(),
		}
	},

	data() {
		return {
			showReloadButton: false,
			codeBlocks: null,
			currentCodeBlock: null,
			copyButtonOffset: 0,
		}
	},

	computed: {
		renderedMessage() {
			if (this.isFileShareMessage && this.message !== '{file}') {
				// Add a new line after file to split content into different paragraphs
				return '{file}' + '\n\n' + this.message
			} else {
				return this.message
			}
		},

		isSystemMessage() {
			return this.systemMessage !== ''
		},

		isDeletedMessage() {
			return this.messageType === 'comment_deleted'
		},

		isFileShareMessage() {
			return this.messageParameters?.file
		},

		hideDate() {
			return this.isTemporary || this.isDeleting || !!this.sendingFailure
		},

		messageTime() {
			if (this.hideDate) {
				return null
			}
			return moment(this.timestamp * 1000).format('LT')
		},

		messageDate() {
			if (this.hideDate) {
				return null
			}
			return moment(this.timestamp * 1000).format('LL')
		},

		isLastCallStartedMessage() {
			return this.systemMessage === 'call_started' && this.id === this.$store.getters.getLastCallStartedMessageId
		},

		showJoinCallButton() {
			return this.hasCall && !this.isInCall && this.isLastCallStartedMessage
		},

		showResultsButton() {
			return this.systemMessage === 'poll_closed'
		},

		isSingleEmoji() {
			if (this.isSystemMessage || this.isDeletedMessage) {
				return
			}

			const trimmedMessage = this.renderedMessage.trim()
			const emojiMatches = trimmedMessage.match(regex)
			return emojiMatches !== null && emojiMatches.length === 1 && emojiMatches[0] === trimmedMessage
		},

		showLoadingIcon() {
			return (this.isTemporary && !this.isFileShareMessage) || this.isDeleting
		},

		loadingIconTooltip() {
			return t('spreed', 'Sending message')
		},

		sendingErrorCanRetry() {
			return ['timeout', 'other', 'failed-upload'].includes(this.sendingFailure)
		},

		sendingErrorIconTooltip() {
			if (this.sendingErrorCanRetry) {
				return t('spreed', 'Failed to send the message. Click to try again')
			}
			if (this.sendingFailure === 'quota') {
				return t('spreed', 'Not enough free space to upload file')
			}
			if (this.sendingFailure === 'failed-share') {
				return t('spreed', 'You are not allowed to share files')
			}
			return t('spreed', 'You cannot send messages to this conversation at the moment')
		},

		containsCodeBlocks() {
			return this.message.includes('```')
		},
	},

	watch: {
		showJoinCallButton() {
			EventBus.$emit('scroll-chat-to-bottom')
		},
	},

	mounted() {
		if (!this.containsCodeBlocks) {
			return
		}

		this.codeBlocks = Array.from(this.$refs.messageMain?.querySelectorAll('pre'))
	},

	methods: {
		handleMarkdownMouseOver(event) {
			if (!this.containsCodeBlocks) {
				return
			}

			const index = this.codeBlocks.findIndex(item => item.contains(event.target))
			if (index !== -1) {
				this.currentCodeBlock = index
				const el = this.codeBlocks[index]
				this.copyButtonOffset = `${el.offsetTop}px`
			}
		},

		handleMarkdownMouseLeave() {
			this.currentCodeBlock = null
			this.copyButtonOffset = 0
		},

		async copyCodeBlock() {
			const code = this.codeBlocks[this.currentCodeBlock].textContent
			try {
				await navigator.clipboard.writeText(code)
				showSuccess(t('spreed', 'Code block copied to clipboard'))
			} catch (error) {
				showError(t('spreed', 'Code block could not be copied'))
			}
		},

		handleRetry() {
			if (this.sendingErrorCanRetry) {
				if (this.sendingFailure === 'failed-upload') {
					this.$store.dispatch('retryUploadFiles', {
						token: this.token,
						uploadId: this.$store.getters.message(this.token, this.id)?.uploadId,
						caption: this.renderedMessage !== this.message ? this.message : undefined,
					})
				} else {
					EventBus.$emit('retry-message', this.id)
					EventBus.$emit('focus-chat-input')
				}
			}
		},
	},
}
</script>

<style lang="scss" scoped>
.message-main {
	display: flex;
	justify-content: space-between;
	align-items: flex-start;
	min-width: 100%;

	&__text {
		flex: 0 1 600px;
		width: 100%;
		min-width: 0;
		max-width: 600px;
		color: var(--color-text-light);

		& > .single-emoji {
			font-size: 250%;
			line-height: 100%;
		}

		&.system-message {
			color: var(--color-text-maxcontrast);
			text-align: center;
			padding: 0 20px;
		}

		&.call-started {
			color: var(--color-text-light);
			background-color: var(--color-primary-element-light);
			padding: 10px;
			border-radius: var(--border-radius-large);
			text-align: center;
		}

		&.deleted-message {
			display: flex;
			align-items: center;
			color: var(--color-text-maxcontrast);
			:deep(.rich-text--wrapper) {
				flex-grow: 1;
				text-align: start;
			}
		}

		&.markdown-message {
			position: relative;

			.message-copy-code {
				position: absolute;
				top: 0;
				right: 4px;
				margin-top: 4px;
				background-color: var(--color-background-dark);
			}

			:deep(.rich-text--wrapper) {
				text-align: start;

				// Overwrite core styles, otherwise h4 is lesser than default font-size
				h4 {
				font-size: 100%;
				}

				em {
				font-style: italic;
				}

				ul,
				ol {
				padding-left: 0;
				padding-inline-start: 15px;
				}

				pre {
				padding: 4px;
				margin: 2px 0;
				border-radius: var(--border-radius);
				background-color: var(--color-background-dark);
				overflow-x: auto;

				& code {
					margin: 0;
					padding: 0;
				}
				}

				code {
				display: inline-block;
				padding: 2px 4px;
				margin: 2px 0;
				border-radius: var(--border-radius);
				background-color: var(--color-background-dark);
				}

				blockquote {
				padding-left: 0;
				padding-inline-start: 13px;
				border-left: none;
				border-inline-start: 4px solid var(--color-border);
				}
			}
		}
	}

	&__info {
		justify-self: flex-start;
		justify-content: flex-end;
		position: relative;
		user-select: none;
		display: flex;
		color: var(--color-text-maxcontrast);
		font-size: var(--default-font-size);
		flex: 1 0 auto;
		padding: 0 8px 0 8px;

		.date:last-child {
			margin-right: var(--default-clickable-area);
		}
	}
}

.message-status {
	width: var(--default-clickable-area);
	height: 24px;
	display: flex;
	justify-content: center;
	align-items: center;

	&.retry-option {
		cursor: pointer;
	}
}

// Hardcode to prevent RTL affecting on user mentions
:deep(.rich-text--component) {
	direction: ltr;
}
</style>
