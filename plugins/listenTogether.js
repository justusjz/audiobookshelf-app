import Vue from 'vue'
import { Dialog } from '@capacitor/dialog'
import ListenTogether from '@/utils/ListenTogether'

export default ({ store, app }, inject) => {
  // Native seeks take longer than in a browser so allow more drift before correcting
  const listenTogether = new ListenTogether(store, { driftThreshold: 3 })
  const serverSocket = app.$socket

  // Proxy to the current socket since the socket is re-created when connecting to a server
  listenTogether.setSocket({
    get connected() {
      return !!serverSocket.socket?.connected && serverSocket.isAuthenticated
    },
    emit(...args) {
      serverSocket.socket.emit(...args)
    }
  })

  serverSocket.on('listen_together_state', (data) => listenTogether.onState(data))
  serverSocket.on('listen_together_party', (party) => listenTogether.onPartyUpdated(party))
  serverSocket.on('listen_together_ended', (data) => listenTogether.onEnded(data))
  serverSocket.on('initialized', () => listenTogether.onReconnected())
  serverSocket.on('listen_together_invite', async (invite) => {
    if (store.state.listenTogether.party?.id === invite.partyId) return
    const strings = Vue.prototype.$strings
    const { value } = await Dialog.confirm({
      title: strings.LabelListenTogether,
      message: Vue.prototype.$getString('MessageListenTogetherInvite', [invite.username, invite.title]),
      okButtonTitle: strings.ButtonListenTogetherJoin,
      cancelButtonTitle: strings.ButtonCancel
    })
    if (!value) return
    listenTogether.join({ partyId: invite.partyId }).catch((error) => {
      Vue.prototype.$toast.error(error.message)
    })
  })

  inject('listenTogether', listenTogether)
}
