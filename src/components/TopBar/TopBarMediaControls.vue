<!--
  - @copyright Copyright (c) 2019, Daniel Calviño Sánchez (danxuliu@gmail.com)
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
  - MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
  - GNU Affero General Public License for more details.
  -
  - You should have received a copy of the GNU Affero General Public License
  - along with this program. If not, see <http://www.gnu.org/licenses/>.
  -
  -->
<template>
	<div v-shortkey.push="disableKeyboardShortcuts ? null : ['space']"
		class="buttons-bar"
		@shortkey="handleShortkey">
		<div class="network-connection-state">
			<NcPopover v-if="qualityWarningTooltip"
				:boundary="boundaryElement"
				:aria-label="qualityWarningAriaLabel"
				trigger="hover"
				:auto-hide="false"
				:shown="showQualityWarningTooltip">
				<template #trigger>
					<NcButton id="quality_warning_button"
						type="tertiary-no-background"
						class="trigger"
						:aria-label="qualityWarningAriaLabel"
						@click="mouseover = !mouseover">
						<template #icon>
							<NetworkStrength2Alert fill-color="#e9322d" :size="20" />
						</template>
					</NcButton>
				</template>
				<div class="hint">
					<span>{{ qualityWarningTooltip.content }}</span>
					<div class="hint__actions">
						<NcButton v-if="qualityWarningTooltip.action"
							type="primary"
							class="hint__button"
							@click="executeQualityWarningTooltipAction">
							{{ qualityWarningTooltip.actionLabel }}
						</NcButton>
						<NcButton v-if="!isQualityWarningTooltipDismissed"
							type="tertiary"
							class="hint__button"
							@click="dismissQualityWarningTooltip">
							{{ t('spreed', 'Dismiss') }}
						</NcButton>
					</div>
				</div>
			</NcPopover>
		</div>

		<LocalAudioControlButton ref="audioControl"
			:token="token"
			:conversation="conversation"
			:model="model"
			color="#ffffff" />

		<LocalVideoControlButton :token="token"
			:conversation="conversation"
			:model="model"
			color="#ffffff" />

		<NcButton v-if="isVirtualBackgroundAvailable && !showActions"
			v-tooltip="toggleVirtualBackgroundButtonLabel"
			type="tertiary-no-background"
			:aria-label="toggleVirtualBackgroundButtonLabel"
			:class="blurButtonClass"
			@click.stop="toggleVirtualBackground">
			<template #icon>
				<Blur v-if="isVirtualBackgroundEnabled" :size="20" fill-color="#ffffff" />
				<BlurOff v-else :size="20" fill-color="#ffffff" />
			</template>
		</NcButton>

		<NcActions v-if="!screenSharingButtonHidden"
			id="screensharing-button"
			v-tooltip="screenSharingButtonTooltip"
			:aria-label="screenSharingButtonAriaLabel"
			:class="screenSharingButtonClass"
			class="app-navigation-entry-utils-menu-button"
			:boundaries-element="boundaryElement"
			:container="container"
			:open.sync="screenSharingMenuOpen">
			<!-- Actions button icon -->
			<template #icon>
				<MonitorOff v-if="model.attributes.localScreen" :size="20" fill-color="#ffffff" />
				<MonitorShare v-else :size="20" fill-color="#ffffff" />
			</template>
			<!-- /Actions button icon -->
			<!-- Actions -->
			<NcActionButton v-if="!screenSharingMenuOpen"
				@click.stop="toggleScreenSharingMenu">
				<template #icon>
					<MonitorShare :size="20" fill-color="#ffffff" />
				</template>
				{{ screenSharingButtonTooltip }}
			</NcActionButton>
			<template v-if="model.attributes.localScreen">
				<NcActionButton close-after-click @click="showScreen">
					<template #icon>
						<Monitor :size="20" />
					</template>
					{{ t('spreed', 'Show your screen') }}
				</NcActionButton>
				<NcActionButton close-after-click @click="stopScreen">
					<template #icon>
						<MonitorOff :size="20" />
					</template>
					{{ t('spreed', 'Stop screensharing') }}
				</NcActionButton>
			</template>
		</NcActions>
	</div>
</template>

<script>
import escapeHtml from 'escape-html'

import Blur from 'vue-material-design-icons/Blur.vue'
import BlurOff from 'vue-material-design-icons/BlurOff.vue'
import Monitor from 'vue-material-design-icons/Monitor.vue'
import MonitorOff from 'vue-material-design-icons/MonitorOff.vue'
import MonitorShare from 'vue-material-design-icons/MonitorShare.vue'
import NetworkStrength2Alert from 'vue-material-design-icons/NetworkStrength2Alert.vue'

import { showMessage } from '@nextcloud/dialogs'
import { emit } from '@nextcloud/event-bus'

import NcActionButton from '@nextcloud/vue/dist/Components/NcActionButton.js'
import NcActions from '@nextcloud/vue/dist/Components/NcActions.js'
import NcButton from '@nextcloud/vue/dist/Components/NcButton.js'
import NcPopover from '@nextcloud/vue/dist/Components/NcPopover.js'
import Tooltip from '@nextcloud/vue/dist/Directives/Tooltip.js'

import LocalAudioControlButton from '../CallView/shared/LocalAudioControlButton.vue'
import LocalVideoControlButton from '../CallView/shared/LocalVideoControlButton.vue'

import { useIsInCall } from '../../composables/useIsInCall.js'
import { PARTICIPANT } from '../../constants.js'
import { CONNECTION_QUALITY } from '../../utils/webrtc/analyzers/PeerConnectionAnalyzer.js'
import { callAnalyzer } from '../../utils/webrtc/index.js'
import SpeakingWhileMutedWarner from '../../utils/webrtc/SpeakingWhileMutedWarner.js'

export default {

	name: 'TopBarMediaControls',

	directives: {
		tooltip: Tooltip,
	},
	components: {
		LocalAudioControlButton,
		LocalVideoControlButton,
		NcActionButton,
		NcActions,
		NcButton,
		NcPopover,
		// Icons
		Blur,
		BlurOff,
		Monitor,
		MonitorOff,
		MonitorShare,
		NetworkStrength2Alert,
	},

	props: {
		token: {
			type: String,
			required: true,
		},
		model: {
			type: Object,
			required: true,
		},
		localCallParticipantModel: {
			type: Object,
			required: true,
		},
		screenSharingButtonHidden: {
			type: Boolean,
			default: false,
		},
		showActions: {
			type: Boolean,
			default: true,
		},

		/**
		 * In the sidebar the conversation settings are hidden
		 */
		isSidebar: {
			type: Boolean,
			default: false,
		},
	},

	setup() {
		const isInCall = useIsInCall()
		return { isInCall }
	},

	data() {
		return {
			speakingWhileMutedNotification: null,
			screenSharingMenuOpen: false,
			boundaryElement: document.querySelector('.main-view'),
			mouseover: false,
			callAnalyzer,
			qualityWarningInGracePeriodTimeout: null,
			audioEnabledBeforeSpacebarKeydown: undefined,
			spacebarKeyDown: false,
		}
	},

	computed: {
		isVirtualBackgroundAvailable() {
			return this.model.attributes.virtualBackgroundAvailable
		},

		isVirtualBackgroundEnabled() {
			return this.model.attributes.virtualBackgroundEnabled
		},

		toggleVirtualBackgroundButtonLabel() {
			return this.isVirtualBackgroundEnabled
				? t('spreed', 'Disable background blur')
				: t('spreed', 'Blur background')
		},

		conversation() {
			return this.$store.getters.conversation(this.token) || this.$store.getters.dummyConversation
		},

		isScreensharingAllowed() {
			return this.conversation.permissions & PARTICIPANT.PERMISSIONS.PUBLISH_SCREEN
		},

		blurButtonClass() {
			return {
				'blur-disabled': this.isVirtualBackgroundEnabled,
			}
		},

		screenSharingButtonClass() {
			return {
				'screensharing-enabled': this.isScreensharingAllowed && this.model.attributes.localScreen,
				'no-screensharing-available': !this.isScreensharingAllowed,
			}
		},

		screenSharingButtonTooltip() {
			if (!this.isScreensharingAllowed) {
				return t('spreed', 'You are not allowed to enable screensharing')
			}

			if (this.screenSharingMenuOpen) {
				return null
			}

			if (!this.isScreensharingAllowed) {
				return t('spreed', 'No screensharing')
			}

			return this.model.attributes.localScreen
				? t('spreed', 'Screensharing options')
				: t('spreed', 'Enable screensharing')
		},

		screenSharingButtonAriaLabel() {
			if (this.screenSharingMenuOpen) {
				return ''
			}

			return this.model.attributes.localScreen
				? t('spreed', 'Screensharing options')
				: t('spreed', 'Enable screensharing')
		},

		container() {
			return this.$store.getters.getMainContainerSelector()
		},

		isQualityWarningTooltipDismissed() {
			return this.$store.getters.isQualityWarningTooltipDismissed
		},

		showQualityWarningTooltip() {
			return this.qualityWarningTooltip && (!this.isQualityWarningTooltipDismissed || this.mouseover)
		},

		showQualityWarning() {
			return this.senderConnectionQualityIsBad || this.qualityWarningInGracePeriodTimeout
		},

		senderConnectionQualityIsBad() {
			return this.senderConnectionQualityAudioIsBad
				|| this.senderConnectionQualityVideoIsBad
				|| this.senderConnectionQualityScreenIsBad
		},

		senderConnectionQualityAudioIsBad() {
			return callAnalyzer
				&& (callAnalyzer.attributes.senderConnectionQualityAudio === CONNECTION_QUALITY.VERY_BAD
				 || callAnalyzer.attributes.senderConnectionQualityAudio === CONNECTION_QUALITY.NO_TRANSMITTED_DATA)
		},

		senderConnectionQualityVideoIsBad() {
			return callAnalyzer
				&& (callAnalyzer.attributes.senderConnectionQualityVideo === CONNECTION_QUALITY.VERY_BAD
				 || callAnalyzer.attributes.senderConnectionQualityVideo === CONNECTION_QUALITY.NO_TRANSMITTED_DATA)
		},

		senderConnectionQualityScreenIsBad() {
			return callAnalyzer
				&& (callAnalyzer.attributes.senderConnectionQualityScreen === CONNECTION_QUALITY.VERY_BAD
				 || callAnalyzer.attributes.senderConnectionQualityScreen === CONNECTION_QUALITY.NO_TRANSMITTED_DATA)
		},

		qualityWarningAriaLabel() {
			let label = ''
			if (!this.model.attributes.audioEnabled && this.model.attributes.videoEnabled && this.model.attributes.localScreen) {
				label = t('spreed', 'Bad sent video and screen quality.')
			} else if (!this.model.attributes.audioEnabled && this.model.attributes.localScreen) {
				label = t('spreed', 'Bad sent screen quality.')
			} else if (!this.model.attributes.audioEnabled && this.model.attributes.videoEnabled) {
				label = t('spreed', 'Bad sent video quality.')
			} else if (this.model.attributes.videoEnabled && this.model.attributes.localScreen) {
				label = t('spreed', 'Bad sent audio, video and screen quality.')
			} else if (this.model.attributes.localScreen) {
				label = t('spreed', 'Bad sent audio and screen quality.')
			} else if (this.model.attributes.videoEnabled) {
				label = t('spreed', 'Bad sent audio and video quality.')
			} else {
				label = t('spreed', 'Bad sent audio quality.')
			}

			return label
		},

		qualityWarningTooltip() {
			if (!this.showQualityWarning) {
				return null
			}

			const virtualBackgroundEnabled = this.isVirtualBackgroundAvailable && this.model.attributes.virtualBackgroundEnabled

			const tooltip = {}
			if (!this.model.attributes.audioEnabled && this.model.attributes.videoEnabled && virtualBackgroundEnabled && this.model.attributes.localScreen) {
				tooltip.content = t('spreed', 'Your internet connection or computer are busy and other participants might be unable to see your screen. To improve the situation try to disable the background blur or your video while doing a screen share.')
				tooltip.actionLabel = t('spreed', 'Disable background blur')
				tooltip.action = 'disableVirtualBackground'
			} else if (!this.model.attributes.audioEnabled && this.model.attributes.videoEnabled && this.model.attributes.localScreen) {
				tooltip.content = t('spreed', 'Your internet connection or computer are busy and other participants might be unable to see your screen. To improve the situation try to disable your video while doing a screenshare.')
				tooltip.actionLabel = t('spreed', 'Disable video')
				tooltip.action = 'disableVideo'
			} else if (!this.model.attributes.audioEnabled && this.model.attributes.localScreen) {
				tooltip.content = t('spreed', 'Your internet connection or computer are busy and other participants might be unable to see your screen.')
				tooltip.actionLabel = ''
				tooltip.action = ''
			} else if (!this.model.attributes.audioEnabled && this.model.attributes.videoEnabled) {
				tooltip.content = t('spreed', 'Your internet connection or computer are busy and other participants might be unable to see you.')
				tooltip.actionLabel = ''
				tooltip.action = ''
			} else if (this.model.attributes.videoEnabled && virtualBackgroundEnabled && this.model.attributes.localScreen) {
				tooltip.content = t('spreed', 'Your internet connection or computer are busy and other participants might be unable to understand and see you. To improve the situation try to disable the background blur or your video while doing a screenshare.')
				tooltip.actionLabel = t('spreed', 'Disable background blur')
				tooltip.action = 'disableVirtualBackground'
			} else if (this.model.attributes.videoEnabled && this.model.attributes.localScreen) {
				tooltip.content = t('spreed', 'Your internet connection or computer are busy and other participants might be unable to understand and see you. To improve the situation try to disable your video while doing a screenshare.')
				tooltip.actionLabel = t('spreed', 'Disable video')
				tooltip.action = 'disableVideo'
			} else if (this.model.attributes.localScreen) {
				tooltip.content = t('spreed', 'Your internet connection or computer are busy and other participants might be unable to understand you and see your screen. To improve the situation try to disable your screenshare.')
				tooltip.actionLabel = t('spreed', 'Disable screenshare')
				tooltip.action = 'disableScreenShare'
			} else if (this.model.attributes.videoEnabled && virtualBackgroundEnabled) {
				tooltip.content = t('spreed', 'Your internet connection or computer are busy and other participants might be unable to understand and see you. To improve the situation try to disable the background blur or your video.')
				tooltip.actionLabel = t('spreed', 'Disable background blur')
				tooltip.action = 'disableVirtualBackground'
			} else if (this.model.attributes.videoEnabled) {
				tooltip.content = t('spreed', 'Your internet connection or computer are busy and other participants might be unable to understand and see you. To improve the situation try to disable your video.')
				tooltip.actionLabel = t('spreed', 'Disable video')
				tooltip.action = 'disableVideo'
			} else {
				tooltip.content = t('spreed', 'Your internet connection or computer are busy and other participants might be unable to understand you.')
				tooltip.actionLabel = ''
				tooltip.action = ''
			}

			return tooltip
		},

		disableKeyboardShortcuts() {
			return OCP.Accessibility.disableKeyboardShortcuts()
		},
	},

	watch: {
		senderConnectionQualityIsBad(senderConnectionQualityIsBad) {
			if (!senderConnectionQualityIsBad) {
				return
			}

			if (this.qualityWarningInGracePeriodTimeout) {
				window.clearTimeout(this.qualityWarningInGracePeriodTimeout)
			}

			this.qualityWarningInGracePeriodTimeout = window.setTimeout(() => {
				this.qualityWarningInGracePeriodTimeout = null
			}, 10000)
		},
	},

	mounted() {
		this.speakingWhileMutedWarner = new SpeakingWhileMutedWarner(this.model, this)
	},

	beforeDestroy() {
		this.speakingWhileMutedWarner.destroy()
	},

	methods: {
		/**
		 * This method executes on spacebar keydown and keyup
		 */
		handleShortkey() {
			if (!this.model.attributes.audioAvailable) {
				return
			}

			if (!this.spacebarKeyDown) {
				this.audioEnabledBeforeSpacebarKeydown = this.model.attributes.audioEnabled
				this.spacebarKeyDown = true
				this.$refs.audioControl.toggleAudio()
			} else {
				this.spacebarKeyDown = false
				if (this.audioEnabledBeforeSpacebarKeydown) {
					this.model.enableAudio()
				} else {
					this.model.disableAudio()
				}
				this.audioEnabledBeforeSpacebarKeydown = undefined
			}

		},

		setSpeakingWhileMutedNotification(message) {
			this.speakingWhileMutedNotification = message
		},

		toggleVirtualBackground() {
			if (this.model.attributes.virtualBackgroundEnabled) {
				this.model.disableVirtualBackground()
			} else {
				this.model.enableVirtualBackground()
			}
		},

		toggleScreenSharingMenu() {
			if (IS_DESKTOP) {
				alert('Unfortunately, Screen sharing is not supported by Nextcloud Talk Preview')
				return
			}

			if (!this.isScreensharingAllowed) {
				return
			}

			if (!this.model.getWebRtc().capabilities.supportScreenSharing) {
				if (window.location.protocol === 'https:') {
					showMessage(t('spreed', 'Screen sharing is not supported by your browser.'))
				} else {
					showMessage(t('spreed', 'Screen sharing requires the page to be loaded through HTTPS.'))
				}
				return
			}

			if (!this.model.attributes.localScreen) {
				this.startShareScreen()
			}
		},

		showScreen() {
			if (this.model.attributes.localScreen) {
				emit('switch-screen-to-id', this.localCallParticipantModel.attributes.peerId)
			}
		},

		stopScreen() {
			this.model.stopSharingScreen()
		},

		startShareScreen(mode) {
			this.model.shareScreen(mode, function(err) {
				if (!err) {
					return
				}

				let extensionURL = null

				switch (err.name) {
				case 'HTTPS_REQUIRED':
					showMessage(t('spreed', 'Screensharing requires the page to be loaded through HTTPS.'))
					break
				case 'PERMISSION_DENIED':
				case 'NotAllowedError':
				case 'CEF_GETSCREENMEDIA_CANCELED': // Experimental, may go away in the future.
					break
				case 'FF52_REQUIRED':
					showMessage(t('spreed', 'Sharing your screen only works with Firefox version 52 or newer.'))
					break
				case 'EXTENSION_UNAVAILABLE':
					if (window.chrome) { // Chrome
						extensionURL = 'https://chrome.google.com/webstore/detail/screensharing-for-nextclo/kepnpjhambipllfmgmbapncekcmabkol'
					}

					if (extensionURL) {
						const text = t('spreed', 'Screensharing extension is required to share your screen.')
						const element = '<a href="' + extensionURL + '" target="_blank">' + escapeHtml(text) + '</a>'

						showMessage(element, { isHTML: true })
					} else {
						showMessage(t('spreed', 'Please use a different browser like Firefox or Chrome to share your screen.'))
					}
					break
				default:
					showMessage(t('spreed', 'An error occurred while starting screensharing.'))
					break
				}
			})
		},

		executeQualityWarningTooltipAction() {
			if (this.qualityWarningTooltip.action === '') {
				return
			}
			if (this.qualityWarningTooltip.action === 'disableScreenShare') {
				this.model.stopSharingScreen()
				this.dismissQualityWarningTooltip()
			} else if (this.qualityWarningTooltip.action === 'disableVirtualBackground') {
				this.model.disableVirtualBackground()
				this.dismissQualityWarningTooltip()
			} else if (this.qualityWarningTooltip.action === 'disableVideo') {
				this.model.disableVideo()
				this.dismissQualityWarningTooltip()
			}
		},

		dismissQualityWarningTooltip() {
			this.$store.dispatch('dismissQualityWarningTooltip')
		},
	},
}
</script>

<style lang="scss" scoped>
.buttons-bar {
	display: flex;
	align-items: center;
}

.buttons-bar #screensharing-menu button {
	width: 100%;
	height: auto;
}

/* Highlight the media buttons when enabled */
.buttons-bar button.screensharing-enabled {
	opacity: 1;
}

.buttons-bar button.no-screensharing-available {
	&, & * {
		opacity: .7;
	}
}

.hint {
	padding: 12px;
	max-width: 300px;
	text-align: left;
	&__actions {
		display: flex;
		flex-direction: row-reverse;
		justify-content: space-between;
		padding-top:4px;
	}
	&__button {
		height: var(--default-clickable-area);
	}
}

.trigger {
	display: flex;
	align-items: center;
	justify-content: center;
}
</style>
