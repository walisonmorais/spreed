`<!--
  - @copyright Copyright (c) 2022 Marco Ambrosini <marcoambrosini@pm.me>
  -
  - @author Marco Ambrosini <marcoambrosini@pm.me>
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
	<NcPopover class="poll-voters-details" trigger="hover">
		<template #trigger>
			<NcButton type="tertiary-no-background"
				:aria-label="t('spreed','Voted participants')"
				class="poll-voters-details__button">
				<template #icon>
					<AvatarWrapper v-for="(item, index) in details.slice(0, 8)"
						:id="item.actorId"
						:key="index"
						:name="getDisplayName(item)"
						:source="item.actorType"
						:size="AVATAR.SIZE.EXTRA_SMALL"
						condensed
						disable-menu
						disable-tooltip />
				</template>
			</NcButton>
		</template>
		<div class="poll-voters-details__popover" tabindex="0">
			<div v-for="(item, index) in details"
				:key="index"
				class="poll-voters-details__list-item">
				<AvatarWrapper :id="item.actorId"
					:name="getDisplayName(item)"
					:source="item.actorType"
					:size="AVATAR.SIZE.EXTRA_SMALL"
					disable-menu />
				<p class="poll-voters-details__display-name">
					{{ getDisplayName(item) }}
				</p>
			</div>
		</div>
	</NcPopover>
</template>

<script>
import NcButton from '@nextcloud/vue/dist/Components/NcButton.js'
import NcPopover from '@nextcloud/vue/dist/Components/NcPopover.js'

import AvatarWrapper from '../../../../AvatarWrapper/AvatarWrapper.vue'

import { ATTENDEE, AVATAR } from '../../../../../constants.js'

export default {

	name: 'PollVotersDetails',

	components: {
		AvatarWrapper,
		NcButton,
		NcPopover,
	},

	props: {
		details: {
			type: Array,
			required: true,
		},
	},

	setup() {
		return { AVATAR }
	},

	methods: {
		getDisplayName(item) {
			if (item.actorDisplayName === '' && item.actorType === ATTENDEE.ACTOR_TYPE.GUESTS) {
				return t('spreed', 'Guest')
			}

			if (item.actorType === 'deleted_users') {
				return t('spreed', 'Deleted user')
			}

			return item.actorDisplayName
		},
	},
}
</script>

<style lang="scss" scoped>

.poll-voters-details {
	max-width: 30%;
	margin-right: 8px;

	& &__button,
	&__button :deep(.button-vue__icon) {
		min-height: auto;
		height: auto;
		min-width: auto;
		width: auto !important;
		flex-wrap: wrap;
		justify-content: flex-start;
		border-radius: 0;
		overflow: visible;
	}

	&__popover {
		padding: 8px;
		max-height: 400px;
		overflow-y: scroll;
	}

	&__display-name {
			margin-left: 4px;
		}

	&__list-item {
		display: flex;
		justify-content: flex-start;
		align-items: center;
		min-width: 150px;
		height: 32px;
		margin-bottom: var(--margin-small);
	}
}

</style>
