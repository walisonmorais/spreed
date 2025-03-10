<template>
	<!-- Series of buttons at the top of the tab, these affect all
		 breakout rooms -->
	<div v-if="canModerate || isInBreakoutRoom" class="breakout-rooms-actions">
		<div class="breakout-rooms-actions__row">
			<NcButton v-if="breakoutRoomsNotStarted && canModerate"
				:title="startLabelTitle"
				:aria-label="startLabel"
				type="primary"
				:wide="true"
				:disabled="!isInCall"
				@click="startBreakoutRooms">
				<template #icon>
					<Play :size="20" />
				</template>
				{{ startLabel }}
			</NcButton>
			<NcButton v-else-if="canModerate"
				:title="stopLabel"
				:aria-label="stopLabel"
				type="error"
				:wide="true"
				@click="stopBreakoutRooms">
				<template #icon>
					<Check :size="20" />
				</template>
				{{ stopLabel }}
			</NcButton>
		</div>
		<div class="breakout-rooms-actions__row">
			<NcButton v-if="canModerate && !isInBreakoutRoom"
				:title="sendMessageLabel"
				:aria-label="sendMessageLabel"
				type="secondary"
				:wide="true"
				@click="openSendMessageDialog">
				<template #icon>
					<Send :size="18" />
				</template>
				{{ sendMessageLabel }}
			</NcButton>
			<NcButton v-if="isInBreakoutRoom"
				:title="backToMainRoomLabel"
				:aria-label="backToMainRoomLabel"
				:wide="true"
				type="secondary"
				@click="switchToParentRoom">
				<template #icon>
					<ArrowLeft :size="20" />
				</template>
				{{ backToMainRoomLabel }}
			</NcButton>
			<NcButton v-else-if="!canModerate"
				:title="backToBreakoutRoomLabel"
				:aria-label="backToBreakoutRoomLabel"
				:wide="true"
				type="secondary"
				@click="switchToBreakoutRoom">
				<template #icon>
					<ArrowRight :size="20" />
				</template>
				{{ backToBreakoutRoomLabel }}
			</NcButton>
			<NcActions v-if="canModerate"
				class="right"
				:container="container">
				<NcActionButton v-if="canModerate && isInBreakoutRoom"
					:aria-label="sendMessageLabel"
					@click="openSendMessageDialog">
					<template #icon>
						<Send :size="20" />
					</template>
					{{ sendMessageLabel }}
				</NcActionButton>
				<NcActionButton v-if="canModerate"
					:aria-label="manageBreakoutRoomsTitle"
					@click="openParticipantsEditor">
					<template #icon>
						<Cog :size="20" />
					</template>
					{{ manageBreakoutRoomsTitle }}
				</NcActionButton>
			</NcActions>
		</div>

		<!-- Participants editor -->
		<NcModal v-if="showParticipantsEditor"
			:container="container"
			@close="closeParticipantsEditor">
			<div class="breakout-rooms-actions__editor">
				<h2> {{ manageBreakoutRoomsTitle }} </h2>
				<BreakoutRoomsParticipantsEditor :token="mainToken"
					:breakout-rooms="breakoutRooms"
					:is-creating-rooms="false"
					@close="closeParticipantsEditor"
					v-on="$listeners" />
			</div>
		</NcModal>

		<!-- Send message dialog -->
		<SendMessageDialog v-if="sendMessageDialogOpened"
			:token="mainToken"
			:broadcast="true"
			@close="closeSendMessageDialog" />
	</div>
</template>

<script>
import ArrowLeft from 'vue-material-design-icons/ArrowLeft.vue'
import ArrowRight from 'vue-material-design-icons/ArrowRight.vue'
import Check from 'vue-material-design-icons/Check.vue'
import Cog from 'vue-material-design-icons/Cog.vue'
import Play from 'vue-material-design-icons/Play.vue'
import Send from 'vue-material-design-icons/Send.vue'

import NcActionButton from '@nextcloud/vue/dist/Components/NcActionButton.js'
import NcActions from '@nextcloud/vue/dist/Components/NcActions.js'
import NcButton from '@nextcloud/vue/dist/Components/NcButton.js'
import NcModal from '@nextcloud/vue/dist/Components/NcModal.js'

import BreakoutRoomsParticipantsEditor from '../../BreakoutRoomsEditor/BreakoutRoomsParticipantsEditor.vue'
import SendMessageDialog from '../../BreakoutRoomsEditor/SendMessageDialog.vue'

import { useIsInCall } from '../../../composables/useIsInCall.js'
import { CONVERSATION, PARTICIPANT } from '../../../constants.js'
import { EventBus } from '../../../services/EventBus.js'

export default {
	name: 'BreakoutRoomsActions',

	components: {
		// Components
		NcButton,
		BreakoutRoomsParticipantsEditor,
		SendMessageDialog,
		NcModal,
		NcActions,
		NcActionButton,

		// Icons
		Play,
		Cog,
		Check,
		ArrowLeft,
		ArrowRight,
		Send,
	},

	props: {
		mainToken: {
			type: String,
			required: true,
		},

		mainConversation: {
			type: Object,
			required: true,
		},

		breakoutRooms: {
			type: Array,
			required: true,
		},

		breakoutRoomsConfigured: {
			type: Boolean,
			required: true,
		},
	},

	setup() {
		const isInCall = useIsInCall()
		return { isInCall }
	},

	data() {
		return {
			showParticipantsEditor: false,
			sendMessageDialogOpened: false,
		}
	},

	computed: {
		canFullModerate() {
			return this.mainConversation.participantType === PARTICIPANT.TYPE.OWNER || this.mainConversation.participantType === PARTICIPANT.TYPE.MODERATOR
		},

		canModerate() {
			return !this.isOneToOne && (this.canFullModerate || this.mainConversation.participantType === PARTICIPANT.TYPE.GUEST_MODERATOR)
		},

		breakoutRoomsNotStarted() {
			return this.mainConversation.breakoutRoomStatus !== CONVERSATION.BREAKOUT_ROOM_STATUS.STARTED
		},

		isInBreakoutRoom() {
			return this.mainToken !== this.$store.getters.getToken()
		},

		container() {
			return this.$store.getters.getMainContainerSelector()
		},

		manageBreakoutRoomsTitle() {
			return t('spreed', 'Manage breakout rooms')
		},

		backToMainRoomLabel() {
			return t('spreed', 'Back to main room')
		},

		backToBreakoutRoomLabel() {
			return t('spreed', 'Back to your room')
		},

		sendMessageLabel() {
			return t('spreed', 'Message all rooms')
		},

		startLabel() {
			return t('spreed', 'Start session')
		},

		startLabelTitle() {
			if (this.isInCall) {
				return this.startLabel
			}
			return t('spreed', 'Start a call before you start a breakout room session')
		},

		stopLabel() {
			return t('spreed', 'Stop session')
		},
	},

	methods: {
		startBreakoutRooms() {
			this.$store.dispatch('startBreakoutRoomsAction', this.mainToken)
		},

		stopBreakoutRooms() {
			this.$store.dispatch('stopBreakoutRoomsAction', this.mainToken)
		},

		openSendMessageDialog() {
			this.sendMessageDialogOpened = true
		},

		closeSendMessageDialog() {
			this.sendMessageDialogOpened = false
		},

		openParticipantsEditor() {
			this.showParticipantsEditor = true
		},

		closeParticipantsEditor() {
			this.showParticipantsEditor = false
		},

		async switchToParentRoom() {
			EventBus.$emit('switch-to-conversation', {
				token: this.mainToken,
			})
		},

		async switchToBreakoutRoom() {
			EventBus.$emit('switch-to-conversation', {
				token: this.mainToken,
			})
		},
	},
}
</script>

<style lang="scss" scoped>
.breakout-rooms-actions {
	display: flex;
	flex-direction: column;
	margin-bottom: calc(var(--default-grid-baseline) * 3);

	&__row {
		display: flex;
		margin-bottom: var(--default-grid-baseline);
		gap: var(--default-grid-baseline);
	}

	&__editor {
		height: 100%;
		padding: 20px;
	}
}

.right {
	justify-content: right;
}
</style>
