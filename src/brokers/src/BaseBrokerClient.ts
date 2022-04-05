import amqp from 'amqplib';

export class BaseBrokerClient {
  protected channel: any;

  constructor(
    protected readonly link: string,
  ) {}

  public async init() {
    const connection = await amqp.connect(this.link, 'heartbeat=60');

    connection.on('error', (err) => {
      console.error(err);
    });

    connection.on('close', async () => {
      setTimeout(async () => {
        await this.init();
      }, 5000);
    });

    this.channel = await connection.createChannel();
  }
}