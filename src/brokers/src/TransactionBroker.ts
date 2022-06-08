import { BaseBrokerClient } from "./BaseBrokerClient";

export class TransactionBroker extends BaseBrokerClient {
  constructor(
    link: string,
    protected readonly queueName: string,
  ) {
    super(link);
  }

  public async init() {
    await super.init();
    await this.initQueue();
  }

  private async initQueue() {
    await this.channel.assertQueue(this.queueName, {
      durable: true,
    });
    await this.channel.bindQueue(this.queueName, 'transactions', '');
  }

  public async initConsumer(callback: Function): Promise<void> {
    await this.channel.consume(
      this.queueName,
      await this.executeConsumerMessage(callback)
    )
  }

  private async executeConsumerMessage(callback: Function): Promise<Function> {
    return async function(bufferedMessage) {
      try {
        const message = bufferedMessage.content;
        const content = JSON.parse(message);

        await callback(content);

        await this.channel.ack(bufferedMessage);
      } catch (err) {
        console.error(err);
      }
    }.bind(this);
  }
}
