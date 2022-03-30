import amqp from 'amqplib/callback_api';

export class BaseBroker {
  protected channel: any;

  constructor(
    protected readonly link: string,
    protected readonly queueName: string,
  ) {
    this.init();
  }

  protected init() {
    const createChannel = (error, channel) => {
      console.error(error);
      this.channel = channel;
    }
    const connect = (error, conn) => {
      console.error(error);

      conn.on('error', console.error);
      conn.on('close', _ => this.reconnect());

      conn.createChannel(createChannel);
    }

    amqp.connect(this.link, connect);
  }

  protected reconnect() {
    setTimeout(_ => this.init(), 5000);
  }
}
