/**
 * Checkout.com Magento 2 Payment module (https://www.checkout.com)
 *
 * Copyright (c) 2017 Checkout.com (https://www.checkout.com)
 * Author: David Fiaty | integration@checkout.com
 *
 * License GNU/GPL V3 https://www.gnu.org/licenses/gpl-3.0.en.html
 */

/*browser:true*/
/*global define*/

define(
    [
        'jquery',
        'CheckoutCom_Magento2/js/view/payment/method-renderer/cc-form',
        'Magento_Vault/js/view/payment/vault-enabler',
        'CheckoutCom_Magento2/js/view/payment/adapter',
        'Magento_Checkout/js/model/quote',
        'mage/url',
        'Magento_Checkout/js/action/set-payment-information',
        'Magento_Checkout/js/model/full-screen-loader',
        'Magento_Checkout/js/model/payment/additional-validators',
        'Magento_Checkout/js/action/redirect-on-success'
    ],
    function($, Component, VaultEnabler, CheckoutCom, quote, url, setPaymentInformationAction, fullScreenLoader, additionalValidators, redirectOnSuccessAction, customer) {
        'use strict';

        return Component.extend({
            defaults: {
                active: true,
                template: 'CheckoutCom_Magento2/payment/embedded',
                code: 'checkout_com',
                card_token_id: null,
                redirectAfterPlaceOrder: true
            },

            /**
             * @returns {exports}
             */
            initialize: function() {
                this._super();

                this.vaultEnabler = new VaultEnabler();
                this.vaultEnabler.setPaymentCode(this.getVaultCode());

                return this;
            },

            /**
             * @returns {bool}
             */
            isVaultEnabled: function() {
                return this.vaultEnabler.isVaultEnabled();
            },

            /**
             * @returns {string}
             */
            getVaultCode: function() {
                return window.checkoutConfig.payment[this.getCode()].ccVaultCode;
            },

            /**
             * @returns {string}
             */
            getCode: function() {
                return CheckoutCom.getCode();
            },

            /**
             * @param {string} card_token_id
             */
            setCardTokenId: function(card_token_id) {
                this.card_token_id = card_token_id;
            },

            /**
             * @returns {bool}
             */
            isActive: function() {
                return CheckoutCom.getPaymentConfig()['isActive'];
            },

            /**
             * @returns {string}
             */
            getPublicKey: function() {
                return CheckoutCom.getPaymentConfig()['public_key'];
            },

            /**
             * @returns {string}
             */
            getQuoteValue: function() {
                //return CheckoutCom.getPaymentConfig()['quote_value'];
                return quote.getTotals();
            },

            /**
             * @param {string} card_token_id
             */
            setCardTokenId: function(card_token_id) {
                this.card_token_id = card_token_id;
            },

            /**
             * @returns {string}
             */
            getQuoteCurrency: function() {
                return CheckoutCom.getPaymentConfig()['quote_currency'];
            },

            /**
             * @returns {string}
             */
            getRedirectUrl: function() {
                return url.build('checkout_com/payment/placeOrder');
            },

            /**
             * @returns {void}
             */
            saveSessionData: function() {
                // Prepare the session data
                var sessionData = { saveShopperCard: $('#checkout_com_enable_vault').is(":checked") };

                // Send the session data to be saved
                $.ajax({
                    url: url.build('checkout_com/shopper/sessionData'),
                    type: "POST",
                    data: sessionData,
                    success: function(data, textStatus, xhr) {},
                    error: function(xhr, textStatus, error) {} // todo - improve error handling
                });
            },

            /**
             * @returns {string}
             */
            beforePlaceOrder: function() {
                // Get self
                var self = this;

                // Validate before submission
                if (additionalValidators.validate()) {
                    if (Checkout.isCardFormValid()) {
                        // Set the save card option in session
                        self.saveSessionData();

                        // Submit the form
                        Checkout.submitCardForm();
                    }
                }
            },

            /**
             * @override
             */
            placeOrder: function() {
                var self = this;

                $.migrateMute = true;

                this.isPlaceOrderActionAllowed(false);
                this.getPlaceOrderDeferredObject()
                    .fail(
                        function() {
                            self.isPlaceOrderActionAllowed(true);
                            self.reloadEmbeddedForm();
                        }
                    ).done(
                        function() {
                            self.afterPlaceOrder();

                            if (self.redirectAfterPlaceOrder) {
                                redirectOnSuccessAction.execute();
                            }
                        }
                    );
            },

            /**
             * @returns {void}
             */
            getEmbeddedForm: function() {
                // Get self
                var self = this;

                // Prepare parameters
                var ckoTheme = CheckoutCom.getPaymentConfig()['embedded_theme'];
                var css_file = CheckoutCom.getPaymentConfig()['css_file'];
                var custom_css = CheckoutCom.getPaymentConfig()['custom_css'];
                var ckoThemeOverride = ((custom_css) && custom_css !== '' && css_file == 'custom') ? custom_css : undefined;
                var redirectUrl = self.getRedirectUrl();
                var threeds_enabled = CheckoutCom.getPaymentConfig()['three_d_secure']['enabled'];

                // Initialise the embedded form
                Checkout.init({
                    publicKey: self.getPublicKey(),
                    value: self.getQuoteValue(),
                    currency: self.getQuoteCurrency(),
                    appMode: 'embedded',
                    appContainerSelector: '#embeddedForm',
                    theme: ckoTheme,
                    themeOverride: ckoThemeOverride,
                    cardTokenised: function(event) {

                        // Set the card token
                        self.setCardTokenId(event.data.cardToken);

                        if (threeds_enabled) {
                            window.location.replace(redirectUrl + '?cko-card-token=' + event.data.cardToken + '&cko-context-id=' + self.getEmailAddress());
                        } else {
                            // Place order
                            self.placeOrder();
                        }
                    },
                });
            },

            /**
             * @returns {void}
             */
            reloadEmbeddedForm: function() {
                // Get self
                var self = this;

                // Reload the iframe
                $('#cko-form-holder form iframe').remove();
                self.getEmbeddedForm();
            },
        });
    }
);