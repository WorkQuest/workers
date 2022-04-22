import { BaseBrokerClient } from "./BaseBrokerClient";

export interface Notification {
  recipients: string[];
  action: string;
  data: object;
}

export class NotificationBroker extends BaseBrokerClient {
  constructor(
    link: string,
    protected readonly queueName: string,
  ) {
    super(link);
  }

  public async init() {
    await super.init();
  }

  public async sendNotification(data: Notification) {
    const processedData = Buffer.from(JSON.stringify(data));

    await this.channel.sendToQueue(this.queueName, processedData);
  }
}
