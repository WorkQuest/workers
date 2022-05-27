import { BaseBrokerClient } from "./BaseBrokerClient";

export interface CommunicationData {
  blockNumber: number;
}

export class CommunicationBroker extends BaseBrokerClient {
  constructor(
    link: string,
  ) {
    super(link);
  }

  private queueName = 'communication';

  public async init() {
    await super.init();
    await this.initQueue();
  }

  private async initQueue() {
    await this.channel.assertQueue(this.queueName);
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

  public async sendMessage(message: CommunicationData) {
    console.log(message);
    const processedData = Buffer.from(JSON.stringify(message));

    await this.channel.sendToQueue(this.queueName, processedData);
  }
}
