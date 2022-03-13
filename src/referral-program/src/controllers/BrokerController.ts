import amqp from 'amqplib/callback_api';
import config from '../../config/config.database';
import { Notification } from "./types";

export class ReferralBrokerController {
  private channel;

  public initMessageBroker() {
    amqp.connect(config.notificationMessageBroker.link, (connectError, conn) => {
      if (connectError) {
        console.error(connectError.message);
        return;
      }

      conn.on('error', (connectionError) => {
        console.error(connectionError.message);
      });

      conn.on('close', () => {
        setTimeout(() => {
          this.initMessageBroker();
        }, 5000);
      });

      conn.createChannel((channelError, channel) => {
        if (channelError) {
          console.error(channelError.message);
        }

        this.channel = channel;
      });

      console.log('Referral message broker connected');
    });
  }

  private convertData(data: Notification): Buffer {
    const stringData = JSON.stringify(data);

    return Buffer.from(stringData);
  }

  public sendReferralNotification(data: Notification): void {
    if (!this.channel) return;

    const convertedData = this.convertData(data);

    this.channel.sendToQueue('referral', convertedData);
  }
}

export const ReferralMessageBroker = new ReferralBrokerController();
