<!--
  - @copyright Copyright (c) 2022 Marco Ambrosini <marcoambrosini@icloud.com>
  -
  - @author Marco Ambrosini <marcoambrosini@icloud.com>
  -
  - @license GNU AGPL version 3 or any later version
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
	<div class="breakout-rooms">
		<!-- Actions -->
		<BreakoutRoomsActions :main-token="mainToken"
			:main-conversation="mainConversation"
			:breakout-rooms="breakoutRooms"
			:breakout-rooms-configured="breakoutRoomsConfigured" />
		<!-- Breakout rooms list -->
		<ul v-if="showBreakoutRoomsList">
			<template v-for="breakoutRoom in breakoutRooms">
				<BreakoutRoomItem :key="breakoutRoom.token"
					:breakout-room="breakoutRoom"
					:main-conversation="mainConversation">
					<template v-for="participant in $store.getters.participantsList(breakoutRoom.token)">
						<Participant :key="participant.actorId" :participant="participant" />
					</template>
				</BreakoutRoomItem>
			</template>
		</ul>
		<NcEmptyContent v-else
			class="breakout-rooms__empty-content"
			:name="t('spreed', 'Breakout rooms are not started')">
			<template #icon>
				<DotsCircle :size="20" />
			</template>
		</NcEmptyContent>
	</div>
</template>

<script>
import DotsCircle from 'vue-material-design-icons/DotsCircle.vue'

import NcEmptyContent from '@nextcloud/vue/dist/Components/NcEmptyContent.js'

import BreakoutRoomItem from './BreakoutRoomItem.vue'
import BreakoutRoomsActions from './BreakoutRoomsActions.vue'
import Participant from '../Participants/ParticipantsList/Participant/Participant.vue'

import { CONVERSATION, PARTICIPANT } from '../../../constants.js'

export default {
	name: 'BreakoutRoomsTab',

	components: {
		// Components
		BreakoutRoomItem,
		BreakoutRoomsActions,
		NcEmptyContent,
		Participant,

		// Icons
		DotsCircle,
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

		isActive: {
			type: Boolean,
			required: true,
		},
	},

	data() {
		return {
			breakoutRoomsParticipantsInterval: undefined,
		}
	},

	computed: {
		canFullModerate() {
			return this.mainConversation.participantType === PARTICIPANT.TYPE.OWNER || this.mainConversation.participantType === PARTICIPANT.TYPE.MODERATOR
		},

		canModerate() {
			return !this.isOneToOne && (this.canFullModerate || this.mainConversation.participantType === PARTICIPANT.TYPE.GUEST_MODERATOR)
		},

		showBreakoutRoomsList() {
			return this.breakoutRoomsConfigured
				&& (this.canModerate || this.mainConversation.breakoutRoomStatus === CONVERSATION.BREAKOUT_ROOM_STATUS.STARTED)
		},

		breakoutRooms() {
			return this.$store.getters.breakoutRooms(this.mainToken)
		},

		breakoutRoomsConfigured() {
			return this.mainConversation.breakoutRoomMode !== CONVERSATION.BREAKOUT_ROOM_MODE.NOT_CONFIGURED
		},
	},

	watch: {
		isActive(newValue, oldValue) {
			if (newValue) {
				// Get participants again when opening the tab
				this.getParticipants()
				// Start getting participants every 30 seconds
				this.breakoutRoomsParticipantsInterval = setInterval(() => {
					this.getParticipants()
				}, 30000)
			}

			if (oldValue) {
				// Cleanup previous intervals
				clearInterval(this.breakoutRoomsParticipantsInterval)
			}
		},
	},

	mounted() {
		// Get the breakout room every time the tab is mounted
		this.getBreakoutRooms()
	},

	beforeDestroy() {
		// Clear the interval
		clearInterval(this.breakoutRoomsParticipantsInterval)
	},

	methods: {
		getBreakoutRooms() {
			if (this.breakoutRoomsConfigured) {
				this.$store.dispatch('getBreakoutRoomsAction', {
					token: this.mainToken,
				})
			}
		},

		getParticipants() {
			if (this.breakoutRoomsConfigured) {
				this.$store.dispatch('getBreakoutRoomsParticipantsAction', {
					token: this.mainToken,
				})
			}
		},
	},
}
</script>

<style lang="scss" scoped>

.breakout-rooms {
	display: flex;
	flex-direction: column;
	height: 100%;

	&__empty-content {
		flex: 1;
	}

	&__room {
		margin-top: var(--default-grid-baseline);
	}
}

.right {
	justify-content: right;
}

:deep(.app-navigation-entry__title) {
	font-weight: bold !important;
}

// TODO: upstream collapse icon position fix
:deep(.icon-collapse) {
	position: absolute !important;
	left: 0;
}
</style>
