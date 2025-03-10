<!--
  - @copyright Copyright (c) 2023 Marco Ambrosini <marcoambrosini@icloud.com>
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
	<Fragment>
		<h4 class="app-settings-section__subtitle">
			{{ t('spreed', 'Name') }}
		</h4>
		<EditableTextField :editable="canFullModerate"
			:initial-text="conversationName"
			:editing="isEditingName"
			:loading="isNameLoading"
			:placeholder="t('spreed', 'Enter a name for this conversation')"
			:edit-button-aria-label="t('spreed', 'Edit conversation name')"
			@submit-text="handleUpdateName"
			@update:editing="handleEditName" />
		<template v-if="!isOneToOne">
			<h4 class="app-settings-section__subtitle">
				{{ t('spreed', 'Description') }}
			</h4>
			<EditableTextField :editable="canFullModerate"
				:initial-text="description"
				:editing="isEditingDescription"
				:loading="isDescriptionLoading"
				:edit-button-aria-label="t('spreed', 'Edit conversation description')"
				:placeholder="t('spreed', 'Enter a description for this conversation')"
				multiline
				use-markdown
				@submit-text="handleUpdateDescription"
				@update:editing="handleEditDescription" />
		</template>
		<template v-if="supportsAvatar">
			<h4 class="app-settings-section__subtitle">
				{{ t('spreed', 'Picture') }}
			</h4>
			<ConversationAvatarEditor :conversation="conversation"
				:editable="canFullModerate" />
		</template>
	</Fragment>
</template>

<script>
import { Fragment } from 'vue-frag'

import { getCapabilities } from '@nextcloud/capabilities'
import { showError } from '@nextcloud/dialogs'

import ConversationAvatarEditor from './ConversationAvatarEditor.vue'
import EditableTextField from './EditableTextField.vue'

import { CONVERSATION } from '../../constants.js'

const supportsAvatar = getCapabilities()?.spreed?.features?.includes('avatar')

export default {
	name: 'BasicInfo',

	components: {
		EditableTextField,
		Fragment,
		ConversationAvatarEditor,
	},

	props: {
		conversation: {
			type: Object,
			required: true,
		},

		canFullModerate: {
			type: Boolean,
			required: true,
		},
	},

	setup() {
		return { supportsAvatar }
	},

	data() {
		return {
			isEditingDescription: false,
			isDescriptionLoading: false,
			isEditingName: false,
			isNameLoading: false,
		}
	},

	computed: {
		isOneToOne() {
			return this.conversation.type === CONVERSATION.TYPE.ONE_TO_ONE
				|| this.conversation.type === CONVERSATION.TYPE.ONE_TO_ONE_FORMER
		},

		conversationName() {
			return this.conversation.displayName
		},

		description() {
			return this.conversation.description
		},

		token() {
			return this.conversation.token
		},
	},

	methods: {
		async handleUpdateName(name) {
			this.isNameLoading = true
			try {
				await this.$store.dispatch('setConversationName', {
					token: this.token,
					name,
				})
				this.isEditingName = false
			} catch (error) {
				console.error('Error while setting conversation name', error)
				showError(t('spreed', 'Error while updating conversation name'))
			}
			this.isNameLoading = false
		},

		handleEditName(payload) {
			this.isEditingName = payload
		},

		async handleUpdateDescription(description) {
			this.isDescriptionLoading = true
			try {
				await this.$store.dispatch('setConversationDescription', {
					token: this.token,
					description,
				})
				this.isEditingDescription = false
			} catch (error) {
				console.error('Error while setting conversation description', error)
				showError(t('spreed', 'Error while updating conversation description'))
			}
			this.isDescriptionLoading = false
		},

		handleEditDescription(payload) {
			this.isEditingDescription = payload
		},
	},
}
</script>

<style lang="scss" scoped>

</style>
