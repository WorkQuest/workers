import amqp from 'amqplib/callback_api';
import config from '../config/config.common';
import { BridgeEventType } from './BridgeContract';

export class BridgeBrokerController {
  private channel;

  public initMessageBroker() {
    amqp.connect(config.notificationMessageBroker.link, (connectError, conn) => {
      if (connectError) {
        console.error(connectError.message);
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

      console.log('Bridge message broker connected');
    });
  }

  private convertData(data: BridgeEventType): Buffer {
    const stringData = JSON.stringify(data);

    return Buffer.from(stringData);
  }

  public sendBridgeNotification(data: BridgeEventType): void {
    if (!this.channel) return;

    const convertedData = this.convertData(data);

    this.channel.sendToQueue('bridge', convertedData);
  }
}

export const BridgeMessageBroker = new BridgeBrokerController();
