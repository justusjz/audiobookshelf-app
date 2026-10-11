<template>
  <modals-modal v-model="show" :width="360" height="100%">
    <template #outer>
      <div class="absolute top-8 left-4 z-40">
        <p class="text-white text-2xl truncate">{{ $strings.LabelListenTogether }}</p>
      </div>
    </template>

    <div class="w-full h-full overflow-hidden absolute top-0 left-0 flex items-center justify-center" @click="show = false">
      <div class="w-full overflow-x-hidden overflow-y-auto bg-primary rounded-lg border border-border p-4" style="max-height: 75%" @click.stop>
        <template v-if="party">
          <p class="text-fg-muted text-sm">{{ $strings.LabelListenTogetherPlaying }}</p>
          <p class="text-lg font-semibold truncate mb-4">{{ party.title }}</p>

          <p class="text-fg-muted text-sm mb-1">{{ $strings.LabelListenTogetherCode }}</p>
          <div class="flex items-center mb-1">
            <p class="text-3xl font-mono tracking-widest">{{ party.code }}</p>
            <span class="material-symbols text-2xl ml-3" :class="codeCopied ? 'text-success' : 'text-fg-muted'" @click="copyCode">{{ codeCopied ? 'check' : 'content_copy' }}</span>
          </div>
          <p class="text-xs text-fg-muted mb-4">{{ $strings.MessageListenTogetherCodeHelp }}</p>

          <p class="text-fg-muted text-sm mb-1">{{ $strings.LabelListenTogetherMembers }} ({{ party.members.length }})</p>
          <div v-for="member in party.members" :key="member.userId" class="flex items-center py-1">
            <span class="material-symbols text-lg text-fg-muted">person</span>
            <p class="pl-2 truncate">{{ member.username }}</p>
            <span v-if="member.userId === party.hostUserId" class="ml-2 text-xs text-warning">{{ $strings.LabelListenTogetherHost }}</span>
          </div>

          <p class="text-fg-muted text-sm mt-4 mb-1">{{ $strings.LabelListenTogetherInvite }}</p>
          <p v-if="loadingUsers" class="text-sm text-fg-muted">{{ $strings.MessageLoading }}</p>
          <p v-else-if="!invitableUsers.length" class="text-sm text-fg-muted">{{ $strings.MessageListenTogetherNoUsersOnline }}</p>
          <div v-for="user in invitableUsers" :key="user.id" class="flex items-center py-1">
            <span class="material-symbols text-lg text-fg-muted">person_add</span>
            <p class="pl-2 truncate flex-grow">{{ user.username }}</p>
            <ui-btn small :disabled="invitedUserIds.includes(user.id) || processing" @click="inviteUser(user)">{{ invitedUserIds.includes(user.id) ? $strings.LabelListenTogetherInvited : $strings.ButtonListenTogetherInvite }}</ui-btn>
          </div>

          <div class="flex items-center pt-6">
            <ui-btn v-if="isHost" color="error" class="flex-grow mr-2" :disabled="processing" @click="endParty">{{ $strings.ButtonListenTogetherEnd }}</ui-btn>
            <ui-btn class="flex-grow" :disabled="processing" @click="leaveParty">{{ $strings.ButtonListenTogetherLeave }}</ui-btn>
          </div>
        </template>
        <template v-else>
          <p class="text-sm text-fg-muted mb-4">{{ $strings.MessageListenTogetherDescription }}</p>

          <ui-btn color="success" class="w-full" :disabled="!canCreate || processing" @click="createParty">{{ $strings.ButtonListenTogetherStart }}</ui-btn>
          <p v-if="!canCreate" class="text-xs text-fg-muted pt-1">{{ $strings.MessageListenTogetherNothingPlaying }}</p>

          <div class="flex items-center py-4">
            <div class="flex-grow border-t border-border" />
            <p class="px-3 text-fg-muted text-xs uppercase">{{ $strings.LabelOr }}</p>
            <div class="flex-grow border-t border-border" />
          </div>

          <form class="w-full" @submit.prevent="joinParty">
            <p class="text-fg-muted text-sm mb-1">{{ $strings.LabelListenTogetherCode }}</p>
            <ui-text-input v-model="joinCode" class="font-mono tracking-widest uppercase w-full mb-2" />
            <ui-btn type="submit" class="w-full" :disabled="!joinCode.trim() || processing">{{ $strings.ButtonListenTogetherJoin }}</ui-btn>
          </form>
        </template>
      </div>
    </div>
  </modals-modal>
</template>

<script>
import { Clipboard } from '@capacitor/clipboard'

export default {
  data() {
    return {
      processing: false,
      joinCode: '',
      users: [],
      loadingUsers: false,
      invitedUserIds: [],
      codeCopied: false
    }
  },
  watch: {
    show(newVal) {
      if (newVal) this.init()
    },
    partyId(newVal) {
      this.invitedUserIds = []
      if (newVal && this.show) this.loadUsers()
    }
  },
  computed: {
    show: {
      get() {
        return this.$store.state.listenTogether.showModal
      },
      set(val) {
        this.$store.commit('listenTogether/setShowModal', val)
      }
    },
    party() {
      return this.$store.state.listenTogether.party
    },
    partyId() {
      return this.party?.id || null
    },
    isHost() {
      return this.party?.hostUserId === this.$store.state.user.user?.id
    },
    canCreate() {
      // Only media from the server can be played together
      return !!this.$store.state.currentPlaybackSession?.libraryItemId
    },
    invitableUsers() {
      return this.users.filter((u) => !this.party?.members.some((m) => m.userId === u.id))
    }
  },
  methods: {
    init() {
      this.joinCode = ''
      this.codeCopied = false
      if (this.party) this.loadUsers()
    },
    async loadUsers() {
      this.loadingUsers = true
      try {
        this.users = await this.$listenTogether.getUsers()
      } catch (error) {
        console.error('Failed to load users', error)
        this.users = []
      }
      this.loadingUsers = false
    },
    async copyCode() {
      await Clipboard.write({ string: this.party.code })
      this.codeCopied = true
    },
    async runAction(action) {
      this.processing = true
      try {
        await action()
      } catch (error) {
        console.error('[ListenTogetherModal] Action failed', error)
        this.$toast.error(error.message)
      }
      this.processing = false
    },
    createParty() {
      return this.runAction(() => this.$listenTogether.create())
    },
    joinParty() {
      const code = this.joinCode.trim()
      if (!code) return
      return this.runAction(async () => {
        await this.$listenTogether.join({ code })
        this.show = false
      })
    },
    leaveParty() {
      return this.runAction(async () => {
        await this.$listenTogether.leave()
        this.show = false
      })
    },
    endParty() {
      return this.runAction(async () => {
        await this.$listenTogether.end()
        this.show = false
      })
    },
    inviteUser(user) {
      return this.runAction(async () => {
        await this.$listenTogether.invite(user.id)
        this.invitedUserIds.push(user.id)
        this.$toast.success(this.$getString('ToastListenTogetherInviteSent', [user.username]))
      })
    }
  }
}
</script>
