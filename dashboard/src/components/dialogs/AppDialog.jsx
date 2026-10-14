import { Modal, ModalBody, ModalCloseButton, ModalContent, ModalFooter, ModalHeader, ModalOverlay, } from "@chakra-ui/react";
export const AppDialog = ({ title, children, footer, overlayProps, contentProps, headerProps, closeButtonProps, bodyProps, footerProps, ...modalProps }) => (<Modal {...modalProps}>
		<ModalOverlay {...overlayProps}/>
		<ModalContent {...contentProps}>
			<ModalHeader {...headerProps}>{title}</ModalHeader>
			<ModalCloseButton {...closeButtonProps}/>
			<ModalBody {...bodyProps}>{children}</ModalBody>
			{footer != null && <ModalFooter {...footerProps}>{footer}</ModalFooter>}
		</ModalContent>
	</Modal>);
