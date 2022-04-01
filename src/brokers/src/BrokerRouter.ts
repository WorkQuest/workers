import { BaseBrokerClient } from "./BaseBrokerClient";

export class BrokerRouter extends BaseBrokerClient {
  constructor(
   link: string,
    protected readonly exchangeName: string,
  ) {
    super(link);
  }

  public async init() {
    await super.init();
    await this.initExchange();
  }

  private async initExchange(): Promise<void> {
    await this.channel.assertExchange(this.exchangeName);
  }

  public async sendMessageToExchange(message: object): Promise<void> {
    await this.executeExchangeMessage(message);
  }

  private async executeExchangeMessage(message: object): Promise<void> {
    try {
      const buffer = Buffer.from(JSON.stringify(message));

      this.channel.publish(this.exchangeName, '', buffer, {
        persistent: true
      });
    } catch (err) {
      console.error(err);
    }
  }
}
