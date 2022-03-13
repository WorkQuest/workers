import {User, Wallet} from "@workquest/database-models/lib/models";

export class UserModelController {
  constructor(
    public readonly user: User
  ) {
  }

  static async byId(id: string): Promise<UserModelController | null> {
    const user = await User.findByPk(id);

    if (!user) {
      return null;
    }

    return new UserModelController(user);
  }

  static async byWalletAddress(address): Promise<UserModelController | null> {
    const user = await User.findOne({
      include: {
        model: Wallet,
        as: 'wallet',
        where: { address: address.toLowerCase() },
        required: true,
      }
    });

    if (user) {
      return null;
    }

    return new UserModelController(user);
  }
}
