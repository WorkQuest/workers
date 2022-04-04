import amqp from 'amqplib';

export class BaseBrokerClient {
  protected channel: any;

  constructor(
    protected readonly link: string,
  ) {}

  public async init() {
    const conn = await amqp.connect(this.link, "heartbeat=60");
    this.channel = await conn.createChannel();

    conn.on('error', (err) => {
      console.error(err);
    });

    conn.on('close', async() => {
      setTimeout(async () => {
        await this.init();
      }, 5000);
    });
  }
}
