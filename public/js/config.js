turnConfig = {
    iceServers: [
        {
          urls: "stun:relay.metered.ca:80",
        },
        {
          urls: "turn:relay.metered.ca:80",
          username: "7a092deb2251289df5ba55e4",
          credential: "ePh3LLKLTMEoh9wt",
        },
        {
          urls: "turn:relay.metered.ca:443",
          username: "7a092deb2251289df5ba55e4",
          credential: "ePh3LLKLTMEoh9wt",
        },
        {
          urls: "turn:relay.metered.ca:443?transport=tcp",
          username: "7a092deb2251289df5ba55e4",
          credential: "ePh3LLKLTMEoh9wt",
        },
    ]
  }