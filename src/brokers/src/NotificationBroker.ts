import {BaseBroker} from "./BaseBroker";

export class NotificationBroker<P> extends BaseBroker {
  public notify(payload: P) {
    const buffer = Buffer.from(JSON.stringify(payload));

    this.channel.sendToQueue(this.queueName, buffer);
  }
}
