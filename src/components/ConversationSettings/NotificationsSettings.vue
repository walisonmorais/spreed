<!--
  - @copyright Copyright (c) 2020 Marco Ambrosini <marcoambrosini@icloud.com>
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
	<div class="app-settings-subsection">
		<h4 class="app-settings-section__subtitle">
			{{ t('spreed', 'Notifications') }}
		</h4>

		<NcCheckboxRadioSwitch v-for="level in notificationLevels"
			:key="level.value"
			:value="level.value.toString()"
			:checked.sync="notificationLevel"
			name="notification_level"
			type="radio"
			@update:checked="setNotificationLevel">
			<span class="radio-button">
				<component :is="notificationLevelIcon(level.value)" />
				{{ level.label }}
			</span>
		</NcCheckboxRadioSwitch>

		<NcCheckboxRadioSwitch id="notification_calls"
			type="switch"
			:checked.sync="notifyCalls"
			@update:checked="setNotificationCalls">
			{{ t('spreed', 'Notify about calls in this conversation') }}
		</NcCheckboxRadioSwitch>
	</div>
</template>

<script>
import Account from 'vue-material-design-icons/Account.vue'
import VolumeHigh from 'vue-material-design-icons/VolumeHigh.vue'
import VolumeOff from 'vue-material-design-icons/VolumeOff.vue'

import NcCheckboxRadioSwitch from '@nextcloud/vue/dist/Components/NcCheckboxRadioSwitch.js'

import { PARTICIPANT } from '../../constants.js'

const notificationLevels = [
	{ value: PARTICIPANT.NOTIFY.ALWAYS, label: t('spreed', 'All messages') },
	{ value: PARTICIPANT.NOTIFY.MENTION, label: t('spreed', '@-mentions only') },
	{ value: PARTICIPANT.NOTIFY.NEVER, label: t('spreed', 'Off') },
]

export default {
	name: 'NotificationsSettings',

	components: {
		NcCheckboxRadioSwitch,
	},

	props: {
		conversation: {
			type: Object,
			required: true,
		},
	},

	setup() {
		return {
			notificationLevels,
		}
	},

	data() {
		return {
			notifyCalls: this.conversation.notificationCalls === PARTICIPANT.NOTIFY_CALLS.ON,
			notificationLevel: this.conversation.notificationLevel.toString(),
		}
	},

	methods: {
		notificationLevelIcon(value) {
			switch (value) {
			case PARTICIPANT.NOTIFY.ALWAYS:
				return VolumeHigh
			case PARTICIPANT.NOTIFY.MENTION:
				return Account
			case PARTICIPANT.NOTIFY.NEVER:
			default:
				return VolumeOff
			}
		},

		/**
		 * Set the notification level for the conversation
		 *
		 * @param {number} notificationLevel The notification level to set.
		 */
		async setNotificationLevel(notificationLevel) {
			await this.$store.dispatch('setNotificationLevel', { token: this.conversation.token, notificationLevel })
		},

		/**
		 * Set the call notification level for the conversation
		 *
		 * @param {boolean} isChecked Whether or not call notifications are enabled
		 */
		async setNotificationCalls(isChecked) {
			const notificationCalls = isChecked ? PARTICIPANT.NOTIFY_CALLS.ON : PARTICIPANT.NOTIFY_CALLS.OFF
			await this.$store.dispatch('setNotificationCalls', { token: this.conversation.token, notificationCalls })
		},
	},
}
</script>

<style lang="scss" scoped>
.radio-button {
	display: flex;
	align-items: center;
	gap: calc(2 * var(--default-grid-baseline));
}
</style>
