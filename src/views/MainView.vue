<template>
	<div class="main-view">
		<LobbyScreen v-if="isInLobby" />
		<template v-else>
			<TopBar :is-in-call="showChatInSidebar" />
			<TransitionWrapper name="fade">
				<ChatView v-if="!showChatInSidebar" />
				<template v-else>
					<CallView :token="token" />
				</template>
			</TransitionWrapper>
		</template>
	</div>
</template>

<script>
import CallView from '../components/CallView/CallView.vue'
import ChatView from '../components/ChatView.vue'
import LobbyScreen from '../components/LobbyScreen.vue'
import TopBar from '../components/TopBar/TopBar.vue'
import TransitionWrapper from '../components/TransitionWrapper.vue'

import { useIsInCall } from '../composables/useIsInCall.js'

export default {
	name: 'MainView',
	components: {
		ChatView,
		LobbyScreen,
		TopBar,
		CallView,
		TransitionWrapper,
	},

	props: {
		token: {
			type: String,
			required: true,
		},
	},

	setup() {
		const isInCall = useIsInCall()
		return { isInCall }
	},

	computed: {
		conversation() {
			return this.$store.getters.conversation(this.token)
		},

		showChatInSidebar() {
			return this.isInCall
		},

		isInLobby() {
			return this.$store.getters.isInLobby
		},
	},

	watch: {
		isInLobby(isInLobby) {
			// User is now blocked by the lobby
			if (isInLobby && this.isInCall) {
				this.$store.dispatch('leaveCall', {
					token: this.token,
					participantIdentifier: this.$store.getters.getParticipantIdentifier(),
				})
			}
		},
	},

}
</script>

<style lang="scss" scoped>
.main-view {
	height: 100%;
	width: 100%;
	display: flex;
	flex-grow: 1;
	flex-direction: column;
	align-content: space-between;
	position: relative;
}
</style>
