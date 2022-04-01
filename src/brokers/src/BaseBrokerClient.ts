import amqp from 'amqplib';

export class BaseBrokerClient {
  protected channel: any;

  constructor(
    protected readonly link: string,
  ) {}

  public async init() {
    const conn = await amqp.connect(this.link, "heartbeat=60");
    this.channel = await conn.createChannel();

    this.channel.on('error', (err) => {
      console.error(err);
    });
  }
}
